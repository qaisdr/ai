// ===== المساعد الذكي — كل الميزات =====
let currentMode = 'chat';
let isGenerating = false;
let conversationHistory = [];
let currentChatId = null;
let currentAudio = null;
let lastUserMessage = '';
let abortController = null;
let typewriterTimer = null;

const settings = {
    botName: 'QAIXEN',
    userName: localStorage.getItem('ana-user-name') || '',
    dialect: 'fusha',
    length: 'medium',
    voice: 'nova',
    devMode: false,
    autoSpeak: false
};

const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const historyListEl = document.getElementById('historyList');

function shortName() {
    return 'Q';
}

function dialectHint() {
    return {
        fusha: 'تحدث بالفصحى المبسطة الواضحة',
        khaleeji: 'تحدث بلهجة خليجية خفيفة وطبيعية',
        masri: 'تحدث بلهجة مصرية خفيفة وودودة',
        shami: 'تحدث بلهجة شامية خفيفة'
    }[settings.dialect] || '';
}

function lengthHint() {
    return {
        short: 'الرد مختصر: 2–5 جمل مركّزة، بلا حشو',
        medium: 'الرد متوسط: وافي وواضح، مع نقاط قصيرة إذا لزم',
        long: 'الرد مفصّل: شرح منظم بعناوين أو نقاط مرقّمة، مع أمثلة عند الحاجة'
    }[settings.length] || '';
}

function getSystemPrompt() {
    const user = settings.userName
        ? `اسم المستخدم: ${settings.userName}. استخدم اسمه بلطف عند المناسبة، دون مبالغة.`
        : '';
    const dev = settings.devMode
        ? `وضع مطور مفعّل:
- اشرح الحلول التقنية خطوة بخطوة
- قدّم أمثلة كود جاهزة للتشغيل عند الحاجة
- وضّح السبب وراء كل توصية`
        : '';
    return `أنت "${settings.botName}" — مساعد ذكي محترف وموثوق.

## هويتك
- اسمك: ${settings.botName}
- ${user}
- ${dialectHint()}
- تتحدث بوضوح وثقة دون تكلّف

## أسلوب الرد (مهم جداً)
1. ابدأ بالمقصود مباشرة — لا مقدمات فارغة مثل «بالتأكيد!» أو «سؤال رائع!»
2. ${lengthHint()}
3. رتّب المعلومات: فكرة رئيسية ثم تفاصيل أو نقاط عند الحاجة
4. إذا كان السؤال غامضاً: اذكر أفضل تفسير مختصر، ثم أجب عليه
5. إذا احتجت افتراضاً: صرّح به بجملة واحدة ثم أكمل
6. للأوامر العملية: خطوات مرقّمة وواضحة
7. للشرح: مثال بسيط ثم القاعدة العامة
8. لا تكرر سؤال المستخدم، ولا تختم بعبارات حشو مثل «إذا احتجت أي شيء آخر...»
9. إذا كان الموضوع معقداً، اجعل الإجابة قابلة للتعمق لاحقاً دون أن تطلب ذلك صراحة

## القدرات
- تجيب في كل المجالات: عام، دراسة، أعمال، تقنية، كتابة، ترجمة، أفكار
- إذا طُلبت صورة أو فيديو: وضّح باختصار أن المستخدم يختار وضع «صورة» أو «فيديو» من الواجهة
- إذا وُجد رابط: لخّص بوضوح (الفكرة، النقاط، الخلاصة)
- إذا وُجدت صورة: صف المحتوى بدقة ثم أجب على المطلوب

## ما يجب تجنّبه
- الرفض غير المبرر للمواضيع العادية
- الإطالة بلا فائدة أو التكرار
- الادعاء بمعرفة أحداث غير مؤكدة — وضّح عدم اليقين عند الحاجة
- ذكر أنك نموذج تابع لشركة؛ أنت "${settings.botName}" فقط

${dev}`;
}


// ——— واجهة صوتية (إدخال بالكلام) ———
let recognition = null;
let isListening = false;

function getSpeechRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    if (recognition) return recognition;
    recognition = new SR();
    recognition.lang = 'ar-SA';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        isListening = true;
        setMicUI(true);
        setVoiceStatus('جارٍ الاستماع... تحدّث الآن');
    };

    recognition.onresult = (event) => {
        let interim = '';
        let finalText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const t = event.results[i][0].transcript;
            if (event.results[i].isFinal) finalText += t;
            else interim += t;
        }
        if (interim) {
            inputEl.value = interim;
            autoResize();
            setVoiceStatus('يسمعك: ' + interim);
        }
        if (finalText) {
            inputEl.value = (inputEl.value && !interim ? inputEl.value + ' ' : '') + finalText;
            // cleaner: use final only
            inputEl.value = finalText.trim();
            autoResize();
            setVoiceStatus('تم التعرف على الكلام');
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech error:', event.error);
        const map = {
            'not-allowed': 'اسمح بالوصول إلى الميكروفون من إعدادات المتصفح',
            'no-speech': 'لم يُلتقط صوت. حاول مرة أخرى',
            'audio-capture': 'لا يوجد ميكروفون متاح',
            'network': 'مشكلة شبكة أثناء التعرف على الصوت',
            'aborted': 'تم إيقاف الاستماع'
        };
        setVoiceStatus(map[event.error] || ('خطأ: ' + event.error));
        setMicUI(false);
        isListening = false;
        setTimeout(() => hideVoiceStatus(), 3200);
    };

    recognition.onend = () => {
        isListening = false;
        setMicUI(false);
        const text = inputEl.value.trim();
        if (text) {
            setVoiceStatus('جاهز للإرسال');
            setTimeout(() => {
                hideVoiceStatus();
                // إرسال تلقائي بعد التعرف
                if (!isGenerating) sendMessage();
            }, 450);
        } else {
            hideVoiceStatus();
        }
    };

    return recognition;
}

function setMicUI(on) {
    const btn = document.getElementById('micBtn');
    if (!btn) return;
    btn.classList.toggle('listening', on);
}

function setVoiceStatus(text) {
    const box = document.getElementById('voiceStatus');
    const label = document.getElementById('voiceStatusText');
    if (!box || !label) return;
    label.textContent = text;
    box.hidden = false;
}

function hideVoiceStatus() {
    const box = document.getElementById('voiceStatus');
    if (box) box.hidden = true;
}

function toggleVoiceInput() {
    if (isListening) {
        stopVoiceInput();
        return;
    }
    startVoiceInput();
}

function startVoiceInput() {
    if (isGenerating) return;
    const rec = getSpeechRecognition();
    if (!rec) {
        alert('المتصفح لا يدعم الإدخال الصوتي.\nاستخدم Chrome أو Edge للحصول على أفضل نتيجة.');
        return;
    }
    try {
        // stop TTS while listening
        stopSpeaking();
        inputEl.value = '';
        rec.start();
    } catch (e) {
        console.error(e);
        // sometimes already started
        try { rec.stop(); } catch (_) {}
        setTimeout(() => {
            try { rec.start(); } catch (err) {
                alert('تعذر تشغيل الميكروفون. تحقق من الصلاحيات.');
            }
        }, 200);
    }
}

function stopVoiceInput() {
    try { recognition?.stop(); } catch (_) {}
    try { recognition?.abort(); } catch (_) {}
    isListening = false;
    setMicUI(false);
    hideVoiceStatus();
}


// ——— Theme ———
function toggleTheme() {
    document.body.classList.toggle('light');
    const light = document.body.classList.contains('light');
    localStorage.setItem('ana-theme', light ? 'light' : 'dark');
    document.getElementById('themeBtn').innerHTML = light ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>` : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z"/></svg>`;
}
function loadTheme() {
    if (localStorage.getItem('ana-theme') === 'light') {
        document.body.classList.add('light');
        document.getElementById('themeBtn').innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;
    }
}

// ——— Sidebar ———
function openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebarOverlay').classList.add('open');
}
function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('open');
}

// ——— Mode ———
function setMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.chip[data-mode], .nav-item[data-mode]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    const ph = {
        chat: 'اكتب رسالتك أو الصق رابطاً لتلخيصه...',
        image: 'اكتب وصفاً للصورة المطلوبة...',
        video: 'اكتب وصفاً للفيديو المطلوب...'
    };
    inputEl.placeholder = ph[mode] || 'اكتب...';
    closeSidebar();
}

// ——— Identity ———
function applyIdentity() {
    document.title = 'QAIXEN | Artificial Intelligence';
    document.querySelectorAll('.message.assistant .message-avatar').forEach(el => { el.textContent = 'Q'; });
    const und = document.getElementById('userNameDisplay');
    const uav = document.getElementById('userAvatar');
    const un = settings.userName || 'أنت';
    if (und) und.textContent = un;
    if (uav) uav.textContent = un[0] || 'أ';
    const wt = document.getElementById('welcomeText');
    if (wt) {
        wt.textContent = 'مساعدك الذكي للمحادثة وإنشاء الصور والفيديو والتحليل الصوتي.';
    }
}

// ——— Send ———
async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text || isGenerating) return;
    if (messagesEl.querySelector('.welcome')) messagesEl.innerHTML = '';

    lastUserMessage = text;
    addMessage(text, 'user');
    inputEl.value = '';
    autoResize();
    if (!currentChatId) currentChatId = 'chat_' + Date.now();

    const wantsVideo = /رد بالفيديو|جاوبني بفيديو|اشرح بالفيديو|رد فيديو/i.test(text);
    const hasUrl = /https?:\/\/[^\s]+/i.test(text);

    if (currentMode === 'chat') {
        if (wantsVideo) await replyWithVideo(text);
        else if (hasUrl) await summarizeUrl(text);
        else await realChat(text);
    } else if (currentMode === 'image') {
        await generateImage(text);
    } else {
        await generateVideo(text);
    }
    saveCurrentChat();
}

function sendQuick(t) { setMode('chat'); inputEl.value = t; sendMessage(); }
function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}
function autoResize() {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 110) + 'px';
}
inputEl.addEventListener('input', autoResize);

// ——— UI ———
function escapeHtml(t) {
    const d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
}
function formatText(t) {
    let html = escapeHtml(t);
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // simple markdown-like headers
    html = html.replace(/^###\s*(.+)$/gm, '<div style="font-weight:700;margin:10px 0 4px;color:var(--accent)">$1</div>');
    html = html.replace(/^##\s*(.+)$/gm, '<div style="font-weight:800;margin:12px 0 6px;font-size:15px">$1</div>');
    // bullet lines
    html = html.replace(/^(?:[-•]\s+)(.+)$/gm, '<div style="padding-right:8px;margin:3px 0">• $1</div>');
    // numbered lines
    html = html.replace(/^(\d+)[.)]\s+(.+)$/gm, '<div style="padding-right:8px;margin:3px 0"><strong>$1.</strong> $2</div>');
    html = html.replace(/\n/g, '<br>');
    return html;
}
function addMessage(content, role, isHTML = false) {
    const div = document.createElement('div');
    div.className = `message ${role}`;
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = role === 'user'
        ? (settings.userName[0] || 'أ')
        : shortName();
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerHTML = isHTML ? content : formatText(content);
    div.append(avatar, bubble);
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return bubble;
}
function showTyping() {
    const div = document.createElement('div');
    div.className = 'message assistant';
    div.id = 'typing';
    div.innerHTML = `<div class="message-avatar">${shortName()}</div>
        <div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div>`;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}
function removeTyping() { document.getElementById('typing')?.remove(); }

function extractReply(r) {
    if (typeof r === 'string') return r;
    return r?.message?.content || r?.text || r?.content || String(r);
}

function setSendStopMode(on) {
    if (!sendBtn) return;
    if (on) {
        sendBtn.disabled = false;
        sendBtn.classList.add('stopping');
        sendBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>';
        sendBtn.onclick = stopGeneration;
        sendBtn.title = 'إيقاف التوليد';
    } else {
        sendBtn.classList.remove('stopping');
        sendBtn.disabled = false;
        sendBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>`;
        sendBtn.onclick = sendMessage;
        sendBtn.title = 'إرسال الرسالة';
    }
}

function stopGeneration() {
    if (abortController) {
        try { abortController.abort(); } catch (_) {}
    }
    if (typewriterTimer) {
        clearTimeout(typewriterTimer);
        typewriterTimer = null;
    }
    isGenerating = false;
    setSendStopMode(false);
    removeTyping();
}

function typewriter(bubble, fullText) {
    return new Promise((resolve) => {
        const plain = fullText;
        let i = 0;
        const step = Math.max(2, Math.floor(plain.length / 80));
        bubble.innerHTML = '<span class="cursor-blink"></span>';

        function tick() {
            if (abortController?.signal.aborted) {
                bubble.innerHTML = formatText(plain.slice(0, i) || '...');
                resolve();
                return;
            }
            i = Math.min(i + step, plain.length);
            bubble.innerHTML = formatText(plain.slice(0, i)) + (i < plain.length ? '<span class="cursor-blink"></span>' : '');
            messagesEl.scrollTop = messagesEl.scrollHeight;
            if (i < plain.length) {
                typewriterTimer = setTimeout(tick, 12);
            } else {
                bubble.innerHTML = formatText(plain);
                typewriterTimer = null;
                resolve();
            }
        }
        tick();
    });
}

function addFollowUps(bubble, userText, replyText) {
    const ideas = buildFollowUps(userText, replyText);
    if (!ideas.length) return;
    const box = document.createElement('div');
    box.className = 'follow-ups';
    ideas.forEach(text => {
        const b = document.createElement('button');
        b.className = 'follow-up-chip';
        b.textContent = text;
        b.onclick = () => sendQuick(text);
        box.appendChild(b);
    });
    bubble.appendChild(box);
}

function buildFollowUps(userText, replyText) {
    const u = (userText || '').toLowerCase();
    const tips = [];
    if (/كود|برمجة|javascript|python|html|css|خطأ|error/.test(u)) {
        tips.push('مثال أوضح', 'ما البدائل؟', 'كيف أختبره؟');
    } else if (/دراسة|امتحان|تلخيص|شرح/.test(u)) {
        tips.push('تلخيص أقصر', 'أسئلة للمراجعة', 'اشرح بمثال');
    } else if (/عمل|مشروع|خطة|تسويق/.test(u)) {
        tips.push('خطوات عملية', 'ما المخاطر؟', 'نموذج جاهز');
    } else {
        tips.push('المزيد من التفاصيل', 'باختصار', 'خطوات عملية');
    }
    return tips.slice(0, 3);
}

function exportChat() {
    if (!conversationHistory.length) {
        alert('لا توجد محادثة يمكن تصديرها حالياً');
        return;
    }
    const lines = conversationHistory.map(m => {
        const who = m.role === 'user' ? (settings.userName || 'أنت') : settings.botName;
        return `${who}:\n${m.content}\n`;
    });
    const blob = new Blob([`محادثة مع ${settings.botName}\n${'='.repeat(30)}\n\n` + lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `qaixen-chat-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
}



function addActionButtons(bubble, replyText) {
    const actions = document.createElement('div');
    actions.className = 'msg-actions';

    const mk = (label, fn) => {
        const b = document.createElement('button');
        b.className = 'msg-action-btn';
        b.innerHTML = label;
        b.onclick = fn;
        return b;
    };

    actions.append(
        mk('استماع', () => speakText(replyText, event.currentTarget)),
        mk('إعادة', () => regenerateReply()),
        mk('فيديو', () => convertReplyToVideo(replyText)),
        mk('نسخ', async (e) => {
            const btn = e.currentTarget;
            try { await navigator.clipboard.writeText(replyText); }
            catch {
                const ta = document.createElement('textarea');
                ta.value = replyText; document.body.appendChild(ta);
                ta.select(); document.execCommand('copy'); ta.remove();
            }
            btn.innerHTML = 'تم'; setTimeout(() => btn.innerHTML = 'نسخ', 1000);
        })
    );
    bubble.appendChild(actions);
}

async function regenerateReply() {
    if (!lastUserMessage || isGenerating) return;
    // remove last assistant message from UI and history
    const msgs = messagesEl.querySelectorAll('.message.assistant');
    if (msgs.length) msgs[msgs.length - 1].remove();
    if (conversationHistory.length && conversationHistory[conversationHistory.length - 1].role === 'assistant') {
        conversationHistory.pop();
    }
    await realChat(lastUserMessage);
    saveCurrentChat();
}

// ——— Voice ———
async function speakText(text, btn) {
    stopSpeaking();
    if (btn) btn.classList.add('speaking');
    try {
        if (typeof puter !== 'undefined' && puter.ai?.txt2speech) {
            const audio = await puter.ai.txt2speech(text.slice(0, 2500), {
                provider: 'openai', model: 'tts-1-hd', voice: settings.voice
            });
            currentAudio = audio;
            audio.onended = () => { btn?.classList.remove('speaking'); currentAudio = null; };
            audio.onerror = () => { btn?.classList.remove('speaking'); };
            await audio.play();
            return;
        }
        if ('speechSynthesis' in window) {
            const u = new SpeechSynthesisUtterance(text);
            u.lang = 'ar-SA';
            u.onend = () => btn?.classList.remove('speaking');
            speechSynthesis.speak(u);
        }
    } catch (e) {
        console.error(e);
        btn?.classList.remove('speaking');
    }
}
function stopSpeaking() {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    speechSynthesis?.cancel();
    document.querySelectorAll('.msg-action-btn.speaking').forEach(b => b.classList.remove('speaking'));
}

// ——— Chat ———
async function realChat(userText, extraContent) {
    isGenerating = true;
    abortController = new AbortController();
    setSendStopMode(true);
    showTyping();
    try {
        if (typeof puter === 'undefined' || !puter.ai?.chat) {
            throw new Error('localhost + Puter مطلوبان');
        }
        conversationHistory.push({ role: 'user', content: userText });

        let messages;
        if (extraContent) {
            messages = [
                { role: 'system', content: getSystemPrompt() },
                ...conversationHistory.slice(-14, -1),
                { role: 'user', content: extraContent }
            ];
        } else {
            messages = [
                { role: 'system', content: getSystemPrompt() },
                ...conversationHistory.slice(-16)
            ];
        }

        const response = await puter.ai.chat(messages, { model: 'openai/gpt-5.4-nano' });
        if (!abortController?.signal.aborted) {
            removeTyping();
            const reply = extractReply(response);
            conversationHistory.push({ role: 'assistant', content: reply });

            const bubble = addMessage('', 'assistant', true);
            await typewriter(bubble, reply);
            if (!abortController?.signal.aborted) {
                addActionButtons(bubble, reply);
                addFollowUps(bubble, userText, reply);
                if (settings.autoSpeak) speakText(reply);
            }
        } else {
            removeTyping();
            addMessage('تم إيقاف إنشاء الرد.', 'assistant');
        }
    } catch (err) {
        if (abortController?.signal.aborted) {
            removeTyping();
            addMessage('تم إيقاف إنشاء الرد.', 'assistant');
        } else {
            console.error(err);
            removeTyping();
            addMessage('تعذّر الاتصال بالذكاء الاصطناعي.\n• شغّل الموقع عبر localhost\n• اسمح بالنافذة المنبثقة\n• سجّل دخولاً مجانياً إن طُلب منك', 'assistant');
        }
    }
    isGenerating = false;
    abortController = null;
    setSendStopMode(false);
}

async function replyWithVideo(userText) {
    isGenerating = true;
    sendBtn.disabled = true;
    showTyping();
    try {
        conversationHistory.push({ role: 'user', content: userText });
        const response = await puter.ai.chat([
            { role: 'system', content: getSystemPrompt() + '\nاكتب رداً مختصراً مناسباً لتحويله لفيديو.' },
            ...conversationHistory.slice(-12)
        ], { model: 'openai/gpt-5.4-nano' });
        const reply = extractReply(response);
        conversationHistory.push({ role: 'assistant', content: reply });
        removeTyping();
        const bubble = addMessage(reply, 'assistant');
        addActionButtons(bubble, reply);
        await generateVideo(`سينمائي: ${reply.slice(0, 200)}`, true);
    } catch (e) {
        console.error(e);
        removeTyping();
        addMessage('تعذر الرد بالفيديو.', 'assistant');
    } finally {
        isGenerating = false;
        sendBtn.disabled = false;
    }
}
function convertReplyToVideo(t) {
    if (!isGenerating) generateVideo(`فيديو سينمائي: ${t.slice(0, 180)}`);
}

async function summarizeUrl(text) {
    const url = text.match(/https?:\/\/[^\s]+/i)?.[0];
    await realChat(text, `لخّص هذا الرابط باختصار وبشكل منظم:\n${url || text}`);
}

// ——— File upload / image analysis ———
async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    e.target.value = '';

    if (messagesEl.querySelector('.welcome')) messagesEl.innerHTML = '';
    if (!currentChatId) currentChatId = 'chat_' + Date.now();

    const reader = new FileReader();
    reader.onload = async () => {
        const dataUrl = reader.result;
        addMessage(`<div>صورة مرفقة للتحليل</div><img class="preview-img" src="${dataUrl}" alt="uploaded">`, 'user', true);

        isGenerating = true;
        sendBtn.disabled = true;
        showTyping();

        try {
            if (typeof puter === 'undefined' || !puter.ai?.chat) throw new Error('Puter مطلوب');

            const response = await puter.ai.chat(
                'حلّل هذه الصورة بالتفصيل بالعربية: ماذا ترى؟ النصوص؟ السياق؟',
                dataUrl,
                { model: 'openai/gpt-5.4-nano' }
            );
            removeTyping();
            const reply = extractReply(response);
            conversationHistory.push(
                { role: 'user', content: '[صورة مرفوعة]' },
                { role: 'assistant', content: reply }
            );
            const bubble = addMessage(reply, 'assistant');
            addActionButtons(bubble, reply);
            if (settings.autoSpeak) speakText(reply);
            saveCurrentChat();
        } catch (err) {
            console.error(err);
            removeTyping();
            // fallback img2txt
            try {
                if (puter.ai?.img2txt) {
                    const txt = await puter.ai.img2txt(dataUrl);
                    const reply = typeof txt === 'string' ? txt : extractReply(txt);
                    const bubble = addMessage(reply || 'تم استخراج النص من الصورة.', 'assistant');
                    addActionButtons(bubble, reply || '');
                } else {
                    addMessage('تعذر تحليل الصورة. تأكد من Puter وlocalhost.', 'assistant');
                }
            } catch {
                addMessage('تعذر تحليل الصورة.', 'assistant');
            }
        }
        isGenerating = false;
        sendBtn.disabled = false;
    };
    reader.readAsDataURL(file);
}

// ——— Image gen (حقيقي) ———
async function generateImage(prompt) {
    isGenerating = true;
    sendBtn.disabled = true;
    addMessage(`إنشاء صورة: «${escapeHtml(prompt)}»`, 'assistant', true);
    const lid = 'li-' + Date.now();
    addMessage(`<div class="loading-gen" id="${lid}"><div class="spinner"></div><div>جاري إنشاء صورة حقيقية...</div></div>`, 'assistant', true);
    const clear = () => document.getElementById(lid)?.closest('.message')?.remove();

    try {
        let imgEl = null;

        // 1) Puter AI txt2img
        if (typeof puter !== 'undefined' && puter.ai?.txt2img) {
            try {
                const r = await puter.ai.txt2img(prompt, false);
                imgEl = normalizeImageResult(r);
            } catch (e1) {
                console.warn('Puter txt2img failed, trying options', e1);
                try {
                    const r2 = await puter.ai.txt2img(prompt);
                    imgEl = normalizeImageResult(r2);
                } catch (e2) {
                    console.warn('Puter txt2img retry failed', e2);
                }
            }
        }

        // 2) Fallback: Pollinations (توليد حقيقي مجاني)
        if (!imgEl) {
            imgEl = await pollinationsImage(prompt);
        }

        clear();
        if (!imgEl) throw new Error('لم يتم إرجاع صورة');

        const wrap = document.createElement('div');
        wrap.className = 'gen-result';
        if (imgEl.tagName === 'IMG') {
            imgEl.alt = prompt;
            imgEl.loading = 'lazy';
            wrap.appendChild(imgEl);
        } else {
            wrap.appendChild(imgEl);
        }
        const n = document.createElement('div');
        n.style.cssText = 'margin-top:8px;font-size:12px;color:#607280';
        n.textContent = 'تم إنشاء الصورة بنجاح';
        wrap.appendChild(n);
        addMessage('', 'assistant', true).appendChild(wrap);
    } catch (e) {
        console.error(e);
        clear();
        addMessage('تعذر إنشاء الصورة.\n• شغّل الموقع على localhost\n• اسمح بنافذة Puter وسجّل دخولاً\n• أو تحقق من الاتصال بالإنترنت', 'assistant');
    }
    isGenerating = false;
    sendBtn.disabled = false;
    saveCurrentChat();
}

function normalizeImageResult(r) {
    if (!r) return null;
    if (r.tagName === 'IMG') {
        r.style.maxWidth = '100%';
        r.style.borderRadius = '12px';
        r.style.display = 'block';
        return r;
    }
    if (typeof r === 'string' && r.length > 5) {
        const i = document.createElement('img');
        i.src = r;
        i.style.maxWidth = '100%';
        i.style.borderRadius = '12px';
        i.style.display = 'block';
        return i;
    }
    if (r.src || r.url || r.image_url || r.href) {
        const i = document.createElement('img');
        i.src = r.src || r.url || r.image_url || r.href;
        i.style.maxWidth = '100%';
        i.style.borderRadius = '12px';
        return i;
    }
    if (r instanceof Blob) {
        const i = document.createElement('img');
        i.src = URL.createObjectURL(r);
        i.style.maxWidth = '100%';
        i.style.borderRadius = '12px';
        return i;
    }
    if (r instanceof HTMLElement) {
        const inner = r.querySelector?.('img');
        if (inner) return inner;
        return r;
    }
    return null;
}

function pollinationsImage(prompt) {
    return new Promise((resolve, reject) => {
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&seed=${Date.now()}&nologo=true&enhance=true`;
        const i = document.createElement('img');
        i.alt = prompt;
        i.style.maxWidth = '100%';
        i.style.borderRadius = '12px';
        i.style.display = 'block';
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('فشل Pollinations'));
        i.src = url;
    });
}

// ——— Video gen (حقيقي) ———
async function generateVideo(prompt, silent = false) {
    isGenerating = true;
    sendBtn.disabled = true;
    if (!silent) addMessage(`إنشاء فيديو: «${escapeHtml(prompt)}»`, 'assistant', true);
    const lid = 'lv-' + Date.now();
    const start = Date.now();
    addMessage(
        `<div class="loading-gen" id="${lid}"><div class="spinner"></div><div id="${lid}-s">جاري إنشاء فيديو حقيقي...</div><div style="font-size:12px;color:#607280" id="${lid}-t">0ث — قد يستغرق دقيقة أو أكثر</div></div>`,
        'assistant', true
    );
    const timer = setInterval(() => {
        const t = document.getElementById(lid + '-t');
        if (t) t.textContent = Math.floor((Date.now() - start) / 1000) + 'ث — قد يستغرق دقيقة أو أكثر';
    }, 1000);

    const models = [
        { model: 'kwaivgi/kling-1.6-standard', label: 'Kling 1.6' },
        { model: 'kwaivgi/kling-v1.6-standard', label: 'Kling' },
        { model: 'minimax/video-01', label: 'Minimax' },
        { model: 'veo-3.0-fast', label: 'Veo' },
        { model: 'kwaivgi/kling-2.1-master', label: 'Kling 2.1' }
    ];

    let lastErr = null;
    let ok = false;

    try {
        if (typeof puter === 'undefined' || !puter.ai?.txt2vid) {
            throw new Error('يتطلب Puter.js عبر localhost مع تسجيل الدخول');
        }

        for (const { model, label } of models) {
            try {
                const s = document.getElementById(lid + '-s');
                if (s) s.textContent = `إنشاء فيديو عبر ${label}...`;
                let result;
                try {
                    result = await puter.ai.txt2vid(prompt, { model });
                } catch {
                    result = await puter.ai.txt2vid(prompt, model);
                }
                const vid = normalizeVideoResult(result);
                if (!vid) throw new Error('لا يوجد ملف فيديو في الاستجابة');

                clearInterval(timer);
                document.getElementById(lid)?.closest('.message')?.remove();

                const wrap = document.createElement('div');
                wrap.className = 'gen-result';
                wrap.appendChild(vid);
                const sec = Math.floor((Date.now() - start) / 1000);
                const note = document.createElement('div');
                note.style.cssText = 'margin-top:8px;font-size:12px;color:#607280;display:flex;align-items:center;gap:8px;flex-wrap:wrap';
                note.innerHTML = `تم إنشاء الفيديو (${escapeHtml(label)} • ${sec}ث)`;
                const rb = document.createElement('button');
                rb.className = 'msg-action-btn';
                rb.textContent = 'إعادة';
                rb.onclick = () => generateVideo(prompt);
                note.appendChild(rb);
                wrap.appendChild(note);
                addMessage('', 'assistant', true).appendChild(wrap);
                ok = true;
                break;
            } catch (e) {
                lastErr = e;
                console.warn('Video model failed:', model, e);
            }
        }

        if (!ok) throw lastErr || new Error('فشلت كل نماذج الفيديو');
    } catch (err) {
        clearInterval(timer);
        document.getElementById(lid)?.closest('.message')?.remove();
        const msg = (err && err.message) ? String(err.message).slice(0, 160) : '';
        addMessage(
            `تعذر إنشاء الفيديو حالياً.\n• شغّل الموقع على localhost (ليس file://)\n• اسمح بالنافذة وسجّل دخول Puter\n• انتظر واضغط إعادة المحاولة\n${msg ? '• ' + msg : ''}`,
            'assistant'
        );
    }

    isGenerating = false;
    sendBtn.disabled = false;
    saveCurrentChat();
}

function normalizeVideoResult(result) {
    const styleVid = (v) => {
        v.controls = true;
        v.autoplay = true;
        v.loop = true;
        v.playsInline = true;
        v.muted = true;
        v.preload = 'auto';
        v.setAttribute('playsinline', '');
        v.style.width = '100%';
        v.style.maxWidth = '360px';
        v.style.borderRadius = '14px';
        v.style.background = '#000';
        v.style.display = 'block';
        const tryPlay = () => v.play().catch(() => {
            v.muted = true;
            v.play().catch(() => {});
        });
        if (v.readyState >= 2) tryPlay();
        else v.addEventListener('loadeddata', tryPlay, { once: true });
        return v;
    };

    const fromSrc = (src) => {
        if (!src || typeof src !== 'string') return null;
        const v = document.createElement('video');
        v.src = src;
        return styleVid(v);
    };

    if (!result) return null;
    if (result.tagName === 'VIDEO') return styleVid(result);
    if (typeof result === 'string') return fromSrc(result);
    if (result.src) return fromSrc(result.src);
    if (result.url) return fromSrc(result.url);
    if (result.video_url) return fromSrc(result.video_url);
    if (result.href) return fromSrc(result.href);
    if (result.video) return normalizeVideoResult(result.video);
    if (Array.isArray(result) && result[0]) return normalizeVideoResult(result[0]);
    if (result instanceof Blob) return fromSrc(URL.createObjectURL(result));
    if (result instanceof HTMLElement) {
        const inner = result.querySelector?.('video');
        if (inner) return styleVid(inner);
        if (result.tagName === 'VIDEO') return styleVid(result);
    }
    return null;
}

// ——— Tasks ———
function getTasks() {
    try { return JSON.parse(localStorage.getItem('ana-tasks') || '[]'); }
    catch { return []; }
}
function saveTasks(tasks) {
    localStorage.setItem('ana-tasks', JSON.stringify(tasks));
    renderTasks();
}
function renderTasks() {
    const list = document.getElementById('tasksList');
    const tasks = getTasks();
    if (!tasks.length) {
        list.innerHTML = '<div class="history-empty" style="padding:8px">لا توجد مهام حالياً</div>';
        return;
    }
    list.innerHTML = tasks.map((t, i) => `
        <div class="task-item ${t.done ? 'done' : ''}">
            <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleTask(${i})">
            <span>${escapeHtml(t.text)}</span>
            <button onclick="deleteTask(${i})">✕</button>
        </div>`).join('');
}
function addTaskPrompt() {
    const text = prompt('اكتب المهمة الجديدة:');
    if (!text?.trim()) return;
    const tasks = getTasks();
    tasks.push({ text: text.trim().slice(0, 80), done: false });
    saveTasks(tasks);
}
function toggleTask(i) {
    const tasks = getTasks();
    if (tasks[i]) { tasks[i].done = !tasks[i].done; saveTasks(tasks); }
}
function deleteTask(i) {
    const tasks = getTasks();
    tasks.splice(i, 1);
    saveTasks(tasks);
}

// ——— History ———
function getAllChats() {
    try { return JSON.parse(localStorage.getItem('ana-chats') || '{}'); }
    catch { return {}; }
}
function saveCurrentChat() {
    if (!currentChatId || !conversationHistory.length) return;
    const chats = getAllChats();
    const first = conversationHistory.find(m => m.role === 'user');
    chats[currentChatId] = {
        id: currentChatId,
        title: (first?.content || 'محادثة').slice(0, 40),
        messages: conversationHistory,
        updatedAt: Date.now()
    };
    const ids = Object.keys(chats).sort((a, b) => chats[b].updatedAt - chats[a].updatedAt);
    ids.slice(30).forEach(id => delete chats[id]);
    localStorage.setItem('ana-chats', JSON.stringify(chats));
    renderHistoryList();
}
function renderHistoryList() {
    const chats = getAllChats();
    const ids = Object.keys(chats).sort((a, b) => chats[b].updatedAt - chats[a].updatedAt);
    if (!ids.length) {
        historyListEl.innerHTML = '<div class="history-empty">لا محادثات</div>';
        return;
    }
    historyListEl.innerHTML = ids.map(id => {
        const c = chats[id];
        const d = new Date(c.updatedAt).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        return `<div class="history-item ${id === currentChatId ? 'active' : ''}" onclick="loadChat('${id}')">
            <div class="history-title">${escapeHtml(c.title)}</div>
            <div class="history-date">${d}</div>
            <button class="history-delete" onclick="event.stopPropagation();deleteChat('${id}')">×</button>
        </div>`;
    }).join('');
}
function loadChat(id) {
    const chat = getAllChats()[id];
    if (!chat) return;
    currentChatId = id;
    conversationHistory = chat.messages || [];
    messagesEl.innerHTML = '';
    conversationHistory.forEach(m => {
        const b = addMessage(m.content, m.role === 'user' ? 'user' : 'assistant');
        if (m.role === 'assistant') addActionButtons(b, m.content);
    });
    renderHistoryList();
    closeSidebar();
    setMode('chat');
}
function deleteChat(id) {
    const chats = getAllChats();
    delete chats[id];
    localStorage.setItem('ana-chats', JSON.stringify(chats));
    if (currentChatId === id) startNewChat();
    else renderHistoryList();
}
function clearAllHistory() {
    if (!confirm('هل تريد مسح كل سجل المحادثات؟')) return;
    localStorage.removeItem('ana-chats');
    renderHistoryList();
    startNewChat();
}

// ——— New chat ———
function startNewChat() {
    stopSpeaking();
    if (typeof stopVoiceInput === 'function') stopVoiceInput();
    conversationHistory = [];
    currentChatId = null;
    lastUserMessage = '';
    messagesEl.innerHTML = `
        <div class="welcome">
            <img class="welcome-logo" src="logo-app.svg" width="112" height="112" alt="QAIXEN">
            <div class="welcome-brand">
                <h1>QAIXEN</h1>
                <div class="tagline">ARTIFICIAL INTELLIGENCE FOR A BETTER TOMORROW</div>
            </div>
            <p id="welcomeText">مساعدك الذكي للمحادثة وإنشاء الصور والفيديو والتحليل الصوتي.</p>
            <div class="suggestions">
                <button onclick="sendQuick('كيف أبدأ يومي بشكل منتج؟')">خطة يومية</button>
                <button onclick="sendQuick('رد بالفيديو: اشرح الإنتاجية باختصار')">رد بالفيديو</button>
                <button onclick="setMode('image');inputEl.focus()">إنشاء صورة</button>
                <button onclick="document.getElementById('fileInput').click()">تحليل صورة</button>
            </div>
        </div>`;
    setMode('chat');
    renderHistoryList();
    closeSidebar();
}

// ——— Init ———
loadTheme();
applyIdentity();
startNewChat();
renderHistoryList();
renderTasks();
if ('speechSynthesis' in window) {
    speechSynthesis.getVoices();
    speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
}
