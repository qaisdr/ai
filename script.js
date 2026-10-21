// ===== أنا - المساعد الشخصي =====
// ذكاء اصطناعي حقيقي + صور + فيديوهات عبر Puter.js

let currentMode = 'chat';
let isGenerating = false;
let conversationHistory = []; // لحفظ سياق المحادثة

const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');

// System prompt للمساعد الشخصي
const SYSTEM_PROMPT = `أنت "أنا"، مساعد شخصي ذكي ومتخصص باللغة العربية.
- اسمك: أنا
- شخصيتك: ودود، محترف، مفيد، مباشر، وذكي
- تتحدث باللهجة العربية الفصحى المبسطة أو الخليجية الخفيفة حسب السياق
- تساعد في: الكتابة، التخطيط، النصائح، الأفكار، الترجمة، التلخيص، اتخاذ القرارات
- إذا طلب المستخدم صورة أو فيديو، وجهه لاستخدام أزرار الوضع المناسب
- ردودك واضحة ومفيدة ومنظمة
- لا تقل أنك نموذج لغة كبير أو AI من شركة معينة، أنت "أنا" المساعد الشخصي فقط`;

// ===== Mode switching =====
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
        chat: 'اكتب رسالتك هنا... (ذكاء اصطناعي حقيقي)',
        image: 'صف الصورة اللي تبيها بالتفصيل... مثال: رجل عربي يلبس ثوب ذهبي في صحراء عند الغروب',
        video: 'صف الفيديو اللي تبيه... مثال: أمواج البحر تحت غروب الشمس الذهبي، حركة بطيئة سينمائية'
    };
    inputEl.placeholder = placeholders[mode];
}

// ===== Send message =====
async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text || isGenerating) return;

    const welcome = messagesEl.querySelector('.welcome');
    if (welcome) welcome.remove();

    addMessage(text, 'user');
    inputEl.value = '';
    autoResize();

    if (currentMode === 'chat') {
        await realChat(text);
    } else if (currentMode === 'image') {
        await generateImage(text);
    } else if (currentMode === 'video') {
        await generateVideo(text);
    }
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

// ===== UI helpers =====
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
        // تحويل الأسطر + دعم markdown بسيط
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

function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== REAL AI CHAT (Puter.js) =====
async function realChat(userText) {
    isGenerating = true;
    sendBtn.disabled = true;
    showTyping();

    try {
        if (typeof puter === 'undefined' || !puter.ai || !puter.ai.chat) {
            throw new Error('Puter.js not available');
        }

        // إضافة الرسالة للتاريخ
        conversationHistory.push({ role: 'user', content: userText });

        // بناء الرسائل مع system prompt
        const messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...conversationHistory.slice(-12) // آخر 12 رسالة للحفاظ على السياق
        ];

        const response = await puter.ai.chat(messages, {
            model: 'openai/gpt-5.4-nano'   // سريع ورخيص وجيد
            // model: 'claude-sonnet-4-6'  // أقوى
            // model: 'gpt-5.6-luna'
        });

        removeTyping();

        // استخراج النص من الرد
        let replyText = '';
        if (typeof response === 'string') {
            replyText = response;
        } else if (response?.message?.content) {
            replyText = response.message.content;
        } else if (response?.text) {
            replyText = response.text;
        } else if (response?.content) {
            replyText = response.content;
        } else {
            replyText = JSON.stringify(response);
        }

        // تنظيف إذا كان object
        if (typeof replyText !== 'string') {
            replyText = String(replyText);
        }

        conversationHistory.push({ role: 'assistant', content: replyText });
        addMessage(replyText, 'assistant');

    } catch (err) {
        console.error('Chat error:', err);
        removeTyping();
        
        // رسالة خطأ واضحة
        addMessage(
            'حدثت مشكلة في الاتصال بالذكاء الاصطناعي.\n\n' +
            'الحل:\n' +
            '1. تأكد أنك سمحت بالنافذة المنبثقة لـ Puter\n' +
            '2. سجل دخول مجاني إذا طلب منك\n' +
            '3. أعد المحاولة\n\n' +
            'أو جرب إنشاء صورة/فيديو من الأزرار.',
            'assistant'
        );
    }

    isGenerating = false;
    sendBtn.disabled = false;
}

// ===== REAL IMAGE GENERATION =====
async function generateImage(prompt) {
    isGenerating = true;
    sendBtn.disabled = true;

    addMessage(`جاري إنشاء الصورة الحقيقية: "<strong>${escapeHtml(prompt)}</strong>"`, 'assistant', true);
    
    const loadingId = 'loading-img-' + Date.now();
    addMessage(`
        <div class="loading-gen" id="${loadingId}">
            <div class="spinner"></div>
            <div>يتم توليد الصورة بالذكاء الاصطناعي...</div>
            <div style="font-size:12px;color:#888">قد يطلب تسجيل دخول مجاني لـ Puter</div>
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
                img.alt = prompt;
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
            // Fallback Pollinations
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
                    <div style="margin-top:10px;font-size:13px;color:#aaa">تم إنشاء الصورة بنجاح ✨</div>
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
                    <div style="margin-top:10px;font-size:13px;color:#aaa">تم إنشاء الصورة (وضع احتياطي) ✨</div>
                </div>
            `, 'assistant', true);
        } catch (e2) {
            addMessage('عذراً، حدث خطأ أثناء توليد الصورة. تأكد من اتصالك أو جرب وصفاً مختلفاً.', 'assistant');
        }
    }

    isGenerating = false;
    sendBtn.disabled = false;
}

// ===== REAL VIDEO GENERATION =====
async function generateVideo(prompt) {
    isGenerating = true;
    sendBtn.disabled = true;

    addMessage(`جاري إنشاء الفيديو الحقيقي: "<strong>${escapeHtml(prompt)}</strong>"`, 'assistant', true);

    const loadingId = 'loading-vid-' + Date.now();
    addMessage(`
        <div class="loading-gen" id="${loadingId}">
            <div class="spinner"></div>
            <div>يتم توليد الفيديو بالذكاء الاصطناعي...</div>
            <div style="font-size:12px;color:#888">قد يستغرق دقيقة إلى دقيقتين • قد يطلب تسجيل دخول مجاني</div>
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
        console.error('Video generation error:', err);
        const loadingMsg = document.getElementById(loadingId)?.closest('.message');
        if (loadingMsg) loadingMsg.remove();

        addMessage(`
            <div style="line-height:1.7">
                <strong>حدثت مشكلة أثناء توليد الفيديو</strong><br><br>
                السبب المحتمل:<br>
                • تحتاج تسجيل دخول مجاني في نافذة Puter<br>
                • أو الإنترنت بطيء<br><br>
                <button onclick="setMode('image'); document.getElementById('userInput').value='${escapeHtml(prompt).replace(/'/g, "\\'")}'; document.getElementById('userInput').focus();" 
                    style="background:linear-gradient(135deg,#D4AF37,#B8860B);color:#000;border:none;padding:10px 18px;border-radius:10px;font-family:Cairo;font-weight:600;cursor:pointer;margin-top:8px;">
                    إنشاء صورة من نفس الوصف
                </button>
            </div>
        `, 'assistant', true);
    }

    isGenerating = false;
    sendBtn.disabled = false;
}

// ===== New chat =====
function startNewChat() {
    conversationHistory = []; // مسح السياق
    messagesEl.innerHTML = `
        <div class="welcome">
            <div class="welcome-icon">أنا</div>
            <h2>مرحباً بك</h2>
            <p>أنا مساعدك الشخصي الذكي <strong>الحقيقي</strong>. أرد عليك بذكاء اصطناعي، وأنشئ صور وفيديوهات حقيقية.</p>
            <div class="suggestions">
                <button onclick="sendQuick('كيف أبدأ يومي بشكل منتج؟')">كيف أبدأ يومي بشكل منتج؟</button>
                <button onclick="setMode('image'); document.getElementById('userInput').focus();">أنشئ لي صورة 🖼️</button>
                <button onclick="setMode('video'); document.getElementById('userInput').focus();">أنشئ لي فيديو 🎬</button>
                <button onclick="sendQuick('اكتب لي قائمة مهام لليوم')">اكتب لي قائمة مهام</button>
            </div>
        </div>
    `;
    setMode('chat');
}

function toggleTheme() {
    document.body.classList.toggle('light');
}

// Init
setMode('chat');
