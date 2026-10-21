// ===== أنا - المساعد الشخصي =====
// ذكاء اصطناعي حقيقي + صوت + سجل محادثات + وضع مظلم + موبايل

let currentMode = 'chat';
let isGenerating = false;
let conversationHistory = [];
let lastAssistantReply = '';
let currentChatId = null;
let speakingUtterance = null;

const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const historyListEl = document.getElementById('historyList');

const SYSTEM_PROMPT = `أنت "أنا"، مساعد شخصي ذكي ومتخصص باللغة العربية.
- اسمك: أنا
- شخصيتك: ودود، محترف، مفيد، مباشر، وذكي
- تتحدث بالعربية الفصحى المبسطة أو بلهجة خليجية خفيفة
- تساعد في: الكتابة، التخطيط، النصائح، الأفكار، الترجمة، التلخيص، اتخاذ القرارات
- إذا طلب المستخدم صورة أو فيديو أو "رد بالفيديو"، أخبره أنك ستنشئ محتوى مرئي
- ردودك واضحة ومفيدة ومنظمة
- لا تقل أنك نموذج لغة كبير، أنت "أنا" المساعد الشخصي فقط`;

// ========== THEME ==========
function toggleTheme() {
    document.body.classList.toggle('light');
    const isLight = document.body.classList.contains('light');
    localStorage.setItem('ana-theme', isLight ? 'light' : 'dark');
    document.getElementById('themeBtn').textContent = isLight ? '☀️' : '🌙';
}

function loadTheme() {
    const saved = localStorage.getItem('ana-theme');
    if (saved === 'light') {
        document.body.classList.add('light');
        document.getElementById('themeBtn').textContent = '☀️';
    }
}

// ========== SIDEBAR (Mobile) ==========
function openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebarOverlay').classList.add('open');
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('open');
}

// ========== MODE ==========
function setMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    document.querySelectorAll('.nav-tab').forEach((btn, i) => {
        const modes = ['chat', 'image', 'video'];
        btn.classList.toggle('active', modes[i] === mode);
    });
    
    const placeholders = {
        chat: 'اكتب رسالتك... أو قل "رد بالفيديو"',
        image: 'صف الصورة اللي تبيها بالتفصيل...',
        video: 'صف الفيديو اللي تبيه...'
    };
    inputEl.placeholder = placeholders[mode];
    closeSidebar();
}

// ========== SEND ==========
async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text || isGenerating) return;

    const welcome = messagesEl.querySelector('.welcome');
    if (welcome) welcome.remove();

    addMessage(text, 'user');
    inputEl.value = '';
    autoResize();

    // Ensure we have a chat id
    if (!currentChatId) {
        currentChatId = 'chat_' + Date.now();
    }

    const wantsVideoReply = /رد بالفيديو|جاوبني بفيديو|اشرح بالفيديو|رد فيديو/i.test(text);

    if (currentMode === 'chat') {
        if (wantsVideoReply) {
            await replyWithVideo(text);
        } else {
            await realChat(text);
        }
    } else if (currentMode === 'image') {
        await generateImage(text);
    } else if (currentMode === 'video') {
        await generateVideo(text);
    }

    saveCurrentChat();
}

function sendQuick(text) {
    setMode('chat');
    inputEl.value = text;
    sendMessage();
}

function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

function autoResize() {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
}
inputEl.addEventListener('input', autoResize);

// ========== UI HELPERS ==========
function addMessage(content, role, isHTML = false) {
    const div = document.createElement('div');
    div.className = `message ${role}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = role === 'user' ? 'أ' : 'أنا';
    
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    
    if (isHTML) {
        bubble.innerHTML = content;
    } else {
        let html = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
        bubble.innerHTML = html;
    }
    
    div.appendChild(avatar);
    div.appendChild(bubble);
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return bubble;
}

function showTyping() {
    const div = document.createElement('div');
    div.className = 'message assistant';
    div.id = 'typing';
    div.innerHTML = `
        <div class="message-avatar">أنا</div>
        <div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div>
    `;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function removeTyping() {
    const t = document.getElementById('typing');
    if (t) t.remove();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== VOICE (TTS) - صوت ذكاء اصطناعي حقيقي ==========
let currentAudio = null;

async function speakText(text, btn) {
    // Stop any previous audio
    stopSpeaking();

    if (btn) btn.classList.add('speaking');

    try {
        // 1) Real AI voice via Puter.js (OpenAI HD / ElevenLabs / Polly)
        if (typeof puter !== 'undefined' && puter.ai && puter.ai.txt2speech) {
            // نقطع النص الطويل عشان ما يتجاوز الحد
            const cleanText = text.slice(0, 2500);

            const audio = await puter.ai.txt2speech(cleanText, {
                provider: 'openai',      // صوت طبيعي جداً
                model: 'tts-1-hd',       // جودة عالية
                voice: 'nova'            // صوت ناعم وواضح (يمكن تغييره: alloy, echo, fable, onyx, nova, shimmer)
                // للعربي الأفضل غالباً: nova أو shimmer
            });

            currentAudio = audio;

            audio.onended = () => {
                if (btn) btn.classList.remove('speaking');
                currentAudio = null;
            };
            audio.onerror = () => {
                if (btn) btn.classList.remove('speaking');
                currentAudio = null;
            };

            await audio.play();
            return;
        }

        // 2) Fallback: متصفح
        if ('speechSynthesis' in window) {
            const utter = new SpeechSynthesisUtterance(text);
            utter.lang = 'ar-SA';
            utter.rate = 1.0;

            const voices = speechSynthesis.getVoices();
            const arVoice = voices.find(v => v.lang.startsWith('ar'));
            if (arVoice) utter.voice = arVoice;

            utter.onend = () => { if (btn) btn.classList.remove('speaking'); };
            utter.onerror = () => { if (btn) btn.classList.remove('speaking'); };

            speakingUtterance = utter;
            speechSynthesis.speak(utter);
            return;
        }

        alert('لا يتوفر تحويل نص إلى كلام حالياً');
        if (btn) btn.classList.remove('speaking');

    } catch (err) {
        console.error('TTS error:', err);
        if (btn) btn.classList.remove('speaking');

        // Fallback سريع للمتصفح لو فشل Puter
        if ('speechSynthesis' in window) {
            const utter = new SpeechSynthesisUtterance(text);
            utter.lang = 'ar-SA';
            speechSynthesis.speak(utter);
        }
    }
}

function stopSpeaking() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    if (window.speechSynthesis) speechSynthesis.cancel();
    document.querySelectorAll('.msg-action-btn.speaking').forEach(b => b.classList.remove('speaking'));
}

// ========== REAL AI CHAT ==========
async function realChat(userText) {
    isGenerating = true;
    sendBtn.disabled = true;
    showTyping();

    try {
        if (typeof puter === 'undefined' || !puter.ai || !puter.ai.chat) {
            throw new Error('Puter.js not available');
        }

        conversationHistory.push({ role: 'user', content: userText });

        const messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...conversationHistory.slice(-12)
        ];

        const response = await puter.ai.chat(messages, {
            model: 'openai/gpt-5.4-nano'
        });

        removeTyping();

        let replyText = '';
        if (typeof response === 'string') replyText = response;
        else if (response?.message?.content) replyText = response.message.content;
        else if (response?.text) replyText = response.text;
        else if (response?.content) replyText = response.content;
        else replyText = String(response);

        lastAssistantReply = replyText;
        conversationHistory.push({ role: 'assistant', content: replyText });
        
        const bubble = addMessage(replyText, 'assistant');
        
        // Action buttons: Voice + Video
        const actions = document.createElement('div');
        actions.className = 'msg-actions';
        
        const voiceBtn = document.createElement('button');
        voiceBtn.className = 'msg-action-btn';
        voiceBtn.innerHTML = '🔊 استمع';
        voiceBtn.onclick = () => speakText(replyText, voiceBtn);
        
        const videoBtn = document.createElement('button');
        videoBtn.className = 'msg-action-btn';
        videoBtn.innerHTML = '🎬 حوّل إلى فيديو';
        videoBtn.onclick = () => convertReplyToVideo(replyText);
        
        actions.appendChild(voiceBtn);
        actions.appendChild(videoBtn);
        bubble.appendChild(actions);

    } catch (err) {
        console.error('Chat error:', err);
        removeTyping();
        addMessage(
            'حدثت مشكلة في الاتصال بالذكاء الاصطناعي.\n\n' +
            '1. تأكد أنك تشغّل الموقع عبر سيرفر محلي (localhost)\n' +
            '2. اسمح بالنافذة المنبثقة لـ Puter\n' +
            '3. سجل دخول مجاني إذا طلب منك',
            'assistant'
        );
    }

    isGenerating = false;
    sendBtn.disabled = false;
}

// ========== REPLY WITH VIDEO ==========
async function replyWithVideo(userText) {
    isGenerating = true;
    sendBtn.disabled = true;
    showTyping();

    try {
        if (typeof puter === 'undefined' || !puter.ai) throw new Error('Puter not ready');

        conversationHistory.push({ role: 'user', content: userText });

        const messages = [
            { role: 'system', content: SYSTEM_PROMPT + '\n\nالمستخدم طلب رداً بالفيديو. اكتب رداً مختصراً وواضحاً.' },
            ...conversationHistory.slice(-8)
        ];

        const response = await puter.ai.chat(messages, { model: 'openai/gpt-5.4-nano' });
        let replyText = typeof response === 'string' ? response :
            (response?.message?.content || response?.text || response?.content || String(response));

        lastAssistantReply = replyText;
        conversationHistory.push({ role: 'assistant', content: replyText });

        removeTyping();
        const bubble = addMessage(replyText, 'assistant');
        
        const actions = document.createElement('div');
        actions.className = 'msg-actions';
        const voiceBtn = document.createElement('button');
        voiceBtn.className = 'msg-action-btn';
        voiceBtn.innerHTML = '🔊 استمع';
        voiceBtn.onclick = () => speakText(replyText, voiceBtn);
        actions.appendChild(voiceBtn);
        bubble.appendChild(actions);

        addMessage('جاري تحويل الرد إلى فيديو...', 'assistant');
        const videoPrompt = `سينمائي، عالي الجودة: ${replyText.slice(0, 200)}`;
        await generateVideo(videoPrompt, true);

    } catch (err) {
        console.error(err);
        removeTyping();
        addMessage('حدث خطأ أثناء الرد بالفيديو. جرب مرة أخرى.', 'assistant');
        isGenerating = false;
        sendBtn.disabled = false;
    }
}

function convertReplyToVideo(text) {
    if (isGenerating) return;
    const prompt = `فيديو سينمائي جميل يعبر عن: ${text.slice(0, 180)}`;
    generateVideo(prompt);
}

// ========== IMAGE ==========
async function generateImage(prompt) {
    isGenerating = true;
    sendBtn.disabled = true;

    addMessage(`جاري إنشاء الصورة: "<strong>${escapeHtml(prompt)}</strong>"`, 'assistant', true);
    
    const loadingId = 'loading-img-' + Date.now();
    addMessage(`
        <div class="loading-gen" id="${loadingId}">
            <div class="spinner"></div>
            <div>يتم توليد الصورة بالذكاء الاصطناعي...</div>
        </div>
    `, 'assistant', true);

    try {
        if (typeof puter !== 'undefined' && puter.ai && puter.ai.txt2img) {
            const imgElement = await puter.ai.txt2img(prompt);
            const loadingMsg = document.getElementById(loadingId)?.closest('.message');
            if (loadingMsg) loadingMsg.remove();

            const wrapper = document.createElement('div');
            wrapper.className = 'gen-result';
            
            if (imgElement && imgElement.tagName === 'IMG') {
                imgElement.style.maxWidth = '100%';
                imgElement.style.borderRadius = '12px';
                wrapper.appendChild(imgElement);
            } else if (typeof imgElement === 'string') {
                const img = document.createElement('img');
                img.src = imgElement;
                img.style.maxWidth = '100%';
                img.style.borderRadius = '12px';
                wrapper.appendChild(img);
            } else {
                wrapper.appendChild(imgElement);
            }
            
            const note = document.createElement('div');
            note.style.cssText = 'margin-top:10px;font-size:13px;color:#aaa';
            note.textContent = 'تم إنشاء الصورة بنجاح ✨';
            wrapper.appendChild(note);
            
            const bubble = addMessage('', 'assistant', true);
            bubble.appendChild(wrapper);
        } else {
            const encoded = encodeURIComponent(prompt);
            const seed = Math.floor(Math.random() * 999999);
            const imageUrl = 'https://image.pollinations.ai/prompt/' + encoded + '?width=768&height=768&seed=' + seed + '&nologo=true';
            await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = resolve;
                img.onerror = reject;
                img.src = imageUrl;
            });
            const loadingMsg = document.getElementById(loadingId)?.closest('.message');
            if (loadingMsg) loadingMsg.remove();
            addMessage(`
                <div class="gen-result">
                    <img src="${imageUrl}" alt="${escapeHtml(prompt)}" loading="lazy">
                    <div style="margin-top:10px;font-size:13px;color:#aaa">تم إنشاء الصورة ✨</div>
                </div>
            `, 'assistant', true);
        }
    } catch (err) {
        console.error(err);
        const loadingMsg = document.getElementById(loadingId)?.closest('.message');
        if (loadingMsg) loadingMsg.remove();
        try {
            const encoded = encodeURIComponent(prompt);
            const seed = Math.floor(Math.random() * 999999);
            const imageUrl = 'https://image.pollinations.ai/prompt/' + encoded + '?width=768&height=768&seed=' + seed + '&nologo=true';
            addMessage(`
                <div class="gen-result">
                    <img src="${imageUrl}" alt="${escapeHtml(prompt)}" loading="lazy">
                    <div style="margin-top:10px;font-size:13px;color:#aaa">تم إنشاء الصورة (احتياطي) ✨</div>
                </div>
            `, 'assistant', true);
        } catch {
            addMessage('عذراً، حدث خطأ أثناء توليد الصورة.', 'assistant');
        }
    }

    isGenerating = false;
    sendBtn.disabled = false;
    saveCurrentChat();
}

// ========== VIDEO ==========
async function generateVideo(prompt, silent = false) {
    isGenerating = true;
    sendBtn.disabled = true;

    if (!silent) {
        addMessage(`جاري إنشاء الفيديو: "<strong>${escapeHtml(prompt)}</strong>"`, 'assistant', true);
    }

    const loadingId = 'loading-vid-' + Date.now();
    addMessage(`
        <div class="loading-gen" id="${loadingId}">
            <div class="spinner"></div>
            <div>يتم توليد الفيديو بالذكاء الاصطناعي...</div>
            <div style="font-size:12px;color:#888">قد يستغرق دقيقة إلى دقيقتين</div>
        </div>
    `, 'assistant', true);

    try {
        if (typeof puter === 'undefined' || !puter.ai || !puter.ai.txt2vid) {
            throw new Error('Puter.js not loaded');
        }

        const videoElement = await puter.ai.txt2vid(prompt, {
            model: 'kwaivgi/kling-1.6-standard'
        });

        const loadingMsg = document.getElementById(loadingId)?.closest('.message');
        if (loadingMsg) loadingMsg.remove();

        const wrapper = document.createElement('div');
        wrapper.className = 'gen-result';
        
        if (videoElement && videoElement.tagName === 'VIDEO') {
            videoElement.controls = true;
            videoElement.autoplay = true;
            videoElement.loop = true;
            videoElement.muted = true;
            videoElement.style.maxWidth = '100%';
            videoElement.style.borderRadius = '12px';
            videoElement.style.background = '#000';
            wrapper.appendChild(videoElement);
            videoElement.play().catch(() => {});
        } else if (typeof videoElement === 'string') {
            const vid = document.createElement('video');
            vid.src = videoElement;
            vid.controls = true;
            vid.autoplay = true;
            vid.loop = true;
            vid.muted = true;
            vid.style.maxWidth = '100%';
            vid.style.borderRadius = '12px';
            vid.style.background = '#000';
            wrapper.appendChild(vid);
        } else {
            wrapper.appendChild(videoElement);
        }

        const note = document.createElement('div');
        note.style.cssText = 'margin-top:10px;font-size:13px;color:#aaa';
        note.textContent = 'تم إنشاء الفيديو بنجاح 🎬';
        wrapper.appendChild(note);

        const bubble = addMessage('', 'assistant', true);
        bubble.appendChild(wrapper);

    } catch (err) {
        console.error('Video error:', err);
        const loadingMsg = document.getElementById(loadingId)?.closest('.message');
        if (loadingMsg) loadingMsg.remove();
        addMessage('حدثت مشكلة أثناء توليد الفيديو. تأكد من السماح بنافذة Puter وتسجيل الدخول.', 'assistant');
    }

    isGenerating = false;
    sendBtn.disabled = false;
    saveCurrentChat();
}

// ========== CHAT HISTORY (localStorage) ==========
function getAllChats() {
    try {
        return JSON.parse(localStorage.getItem('ana-chats') || '{}');
    } catch {
        return {};
    }
}

function saveCurrentChat() {
    if (!currentChatId || conversationHistory.length === 0) return;

    const chats = getAllChats();
    const firstUser = conversationHistory.find(m => m.role === 'user');
    const title = firstUser ? firstUser.content.slice(0, 40) : 'محادثة جديدة';

    chats[currentChatId] = {
        id: currentChatId,
        title: title,
        messages: conversationHistory,
        updatedAt: Date.now()
    };

    // Keep only last 30 chats
    const ids = Object.keys(chats).sort((a, b) => chats[b].updatedAt - chats[a].updatedAt);
    if (ids.length > 30) {
        ids.slice(30).forEach(id => delete chats[id]);
    }

    localStorage.setItem('ana-chats', JSON.stringify(chats));
    renderHistoryList();
}

function renderHistoryList() {
    const chats = getAllChats();
    const ids = Object.keys(chats).sort((a, b) => chats[b].updatedAt - chats[a].updatedAt);

    if (ids.length === 0) {
        historyListEl.innerHTML = '<div class="history-empty">لا توجد محادثات محفوظة بعد</div>';
        return;
    }

    historyListEl.innerHTML = ids.map(id => {
        const c = chats[id];
        const date = new Date(c.updatedAt);
        const dateStr = date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const isActive = id === currentChatId ? 'active' : '';
        return `
            <div class="history-item ${isActive}" onclick="loadChat('${id}')">
                <div class="history-title">${escapeHtml(c.title)}</div>
                <div class="history-date">${dateStr}</div>
                <button class="history-delete" onclick="event.stopPropagation(); deleteChat('${id}')">🗑️</button>
            </div>
        `;
    }).join('');
}

function loadChat(id) {
    const chats = getAllChats();
    const chat = chats[id];
    if (!chat) return;

    currentChatId = id;
    conversationHistory = chat.messages || [];
    
    // Rebuild messages UI
    messagesEl.innerHTML = '';
    conversationHistory.forEach(msg => {
        const bubble = addMessage(msg.content, msg.role === 'user' ? 'user' : 'assistant');
        if (msg.role === 'assistant') {
            const actions = document.createElement('div');
            actions.className = 'msg-actions';
            const voiceBtn = document.createElement('button');
            voiceBtn.className = 'msg-action-btn';
            voiceBtn.innerHTML = '🔊 استمع';
            voiceBtn.onclick = () => speakText(msg.content, voiceBtn);
            actions.appendChild(voiceBtn);
            bubble.appendChild(actions);
        }
    });

    renderHistoryList();
    closeSidebar();
    setMode('chat');
}

function deleteChat(id) {
    const chats = getAllChats();
    delete chats[id];
    localStorage.setItem('ana-chats', JSON.stringify(chats));
    
    if (currentChatId === id) {
        startNewChat();
    } else {
        renderHistoryList();
    }
}

function clearAllHistory() {
    if (!confirm('هل تريد مسح كل سجل المحادثات؟')) return;
    localStorage.removeItem('ana-chats');
    renderHistoryList();
    startNewChat();
}

// ========== NEW CHAT ==========
function startNewChat() {
    stopSpeaking();
    conversationHistory = [];
    lastAssistantReply = '';
    currentChatId = null;
    
    messagesEl.innerHTML = `
        <div class="welcome">
            <div class="welcome-icon">أنا</div>
            <h2>مرحباً بك</h2>
            <p>أنا مساعدك الشخصي الذكي الحقيقي.<br>
            أقدر أرد عليك نصياً أو <strong>بالفيديو</strong> أو <strong>بالصوت</strong>.</p>
            <div class="suggestions">
                <button onclick="sendQuick('كيف أبدأ يومي بشكل منتج؟')">كيف أبدأ يومي بشكل منتج؟</button>
                <button onclick="sendQuick('رد بالفيديو: اشرح لي كيف أكون منتج')">رد بالفيديو 🎬</button>
                <button onclick="setMode('image'); document.getElementById('userInput').focus();">أنشئ لي صورة</button>
                <button onclick="setMode('video'); document.getElementById('userInput').focus();">أنشئ لي فيديو</button>
            </div>
        </div>
    `;
    setMode('chat');
    renderHistoryList();
    closeSidebar();
}

// ========== INIT ==========
loadTheme();
renderHistoryList();
setMode('chat');

// Load voices for TTS
if ('speechSynthesis' in window) {
    speechSynthesis.getVoices();
    speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
}
