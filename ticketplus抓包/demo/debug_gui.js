(function () {
    // Create GUI Container
    const gui = document.createElement('div');
    Object.assign(gui.style, {
        position: 'fixed',
        top: '60px',
        right: '10px',
        width: '300px',
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        color: '#fff',
        padding: '15px',
        borderRadius: '8px',
        fontFamily: 'sans-serif',
        fontSize: '12px',
        zIndex: '9999',
        maxHeight: '85vh',
        overflowY: 'auto',
        display: 'none'
    });
    document.body.appendChild(gui);

    // Secret Toggle: Press "D" three times quickly
    let keyPresses = [];
    document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'd') {
            keyPresses.push(Date.now());
            keyPresses = keyPresses.filter(t => Date.now() - t < 1000);
            if (keyPresses.length >= 3) {
                gui.style.display = gui.style.display === 'none' ? 'block' : 'none';
                keyPresses = [];
            }
        }
        if (e.key === 'Escape') {
            gui.style.display = 'none';
        }
    });

    // Helper to create controls
    function createControl(label, selector, styleProp, min, max, step, unit = 'px', defaultValue) {
        const container = document.createElement('div');
        container.style.marginBottom = '8px';

        const labelEl = document.createElement('div');
        labelEl.style.marginBottom = '3px';
        labelEl.style.display = 'flex';
        labelEl.style.justifyContent = 'space-between';

        const labelText = document.createElement('span');
        labelText.textContent = label;

        const valDisplay = document.createElement('span');
        valDisplay.style.color = '#afeeee';

        const input = document.createElement('input');
        input.type = 'range';
        input.min = min;
        input.max = max;
        input.step = step;
        input.style.width = '100%';

        input.value = defaultValue;
        valDisplay.textContent = defaultValue + unit;

        input.oninput = (e) => {
            const val = e.target.value;
            valDisplay.textContent = val + unit;
            const el = document.querySelector(selector);
            if (el) el.style[styleProp] = val + unit;
        };

        labelEl.appendChild(labelText);
        labelEl.appendChild(valDisplay);
        container.appendChild(labelEl);
        container.appendChild(input);
        gui.appendChild(container);
    }

    // Control for multiple elements
    function createControlMultiple(label, selector, styleProp, min, max, step, unit = 'px', defaultValue) {
        const container = document.createElement('div');
        container.style.marginBottom = '8px';

        const labelEl = document.createElement('div');
        labelEl.style.marginBottom = '3px';
        labelEl.style.display = 'flex';
        labelEl.style.justifyContent = 'space-between';

        const labelText = document.createElement('span');
        labelText.textContent = label;

        const valDisplay = document.createElement('span');
        valDisplay.style.color = '#afeeee';

        const input = document.createElement('input');
        input.type = 'range';
        input.min = min;
        input.max = max;
        input.step = step;
        input.style.width = '100%';

        input.value = defaultValue;
        valDisplay.textContent = defaultValue + unit;

        input.oninput = (e) => {
            const val = e.target.value;
            valDisplay.textContent = val + unit;
            document.querySelectorAll(selector).forEach(el => {
                el.style[styleProp] = val + unit;
            });
        };

        labelEl.appendChild(labelText);
        labelEl.appendChild(valDisplay);
        container.appendChild(labelEl);
        container.appendChild(input);
        gui.appendChild(container);
    }

    // Font weight control
    function createWeightControl(label, selector, defaultValue = 500) {
        const container = document.createElement('div');
        container.style.marginBottom = '8px';

        const labelEl = document.createElement('div');
        labelEl.style.marginBottom = '3px';
        labelEl.style.display = 'flex';
        labelEl.style.justifyContent = 'space-between';

        const labelText = document.createElement('span');
        labelText.textContent = label;

        const valDisplay = document.createElement('span');
        valDisplay.style.color = '#afeeee';

        const input = document.createElement('input');
        input.type = 'range';
        input.min = 100;
        input.max = 900;
        input.step = 100;
        input.style.width = '100%';

        input.value = defaultValue;
        valDisplay.textContent = defaultValue;

        input.oninput = (e) => {
            const val = e.target.value;
            valDisplay.textContent = val;
            const el = document.querySelector(selector);
            if (el) el.style.fontWeight = val;
        };

        labelEl.appendChild(labelText);
        labelEl.appendChild(valDisplay);
        container.appendChild(labelEl);
        container.appendChild(input);
        gui.appendChild(container);
    }

    // Font weight control for multiple elements
    function createWeightControlMultiple(label, selector, defaultValue = 500) {
        const container = document.createElement('div');
        container.style.marginBottom = '8px';

        const labelEl = document.createElement('div');
        labelEl.style.marginBottom = '3px';
        labelEl.style.display = 'flex';
        labelEl.style.justifyContent = 'space-between';

        const labelText = document.createElement('span');
        labelText.textContent = label;

        const valDisplay = document.createElement('span');
        valDisplay.style.color = '#afeeee';

        const input = document.createElement('input');
        input.type = 'range';
        input.min = 100;
        input.max = 900;
        input.step = 100;
        input.style.width = '100%';

        input.value = defaultValue;
        valDisplay.textContent = defaultValue;

        input.oninput = (e) => {
            const val = e.target.value;
            valDisplay.textContent = val;
            document.querySelectorAll(selector).forEach(el => {
                el.style.fontWeight = val;
            });
        };

        labelEl.appendChild(labelText);
        labelEl.appendChild(valDisplay);
        container.appendChild(labelEl);
        container.appendChild(input);
        gui.appendChild(container);
    }

    // Section Divider
    function addSectionTitle(text) {
        const t = document.createElement('div');
        t.textContent = text;
        t.style.fontWeight = 'bold';
        t.style.margin = '10px 0 5px 0';
        t.style.borderBottom = '1px solid #555';
        t.style.paddingBottom = '3px';
        t.style.fontSize = '11px';
        gui.appendChild(t);
    }

    // Title
    const title = document.createElement('h3');
    title.textContent = "实时参数调节";
    title.style.marginTop = '0';
    title.style.marginBottom = '5px';
    title.style.borderBottom = '1px solid #777';
    title.style.paddingBottom = '5px';
    gui.appendChild(title);

    const hint = document.createElement('div');
    hint.textContent = '按 Esc 关闭 | 连按3次D键打开';
    hint.style.fontSize = '10px';
    hint.style.color = '#888';
    hint.style.marginBottom = '10px';
    gui.appendChild(hint);

    // --- Final Parameters ---

    addSectionTitle('Artist (日向坂46)');
    createControl('顶部距离', '.artist-block', 'marginTop', 0, 200, 1, 'px', 62);
    createControl('左边距', '.artist-block', 'marginLeft', -50, 100, 1, 'px', -8);
    createControl('字体大小', '.artist-block .text-value', 'fontSize', 10, 30, 1, 'px', 15);
    createWeightControl('字体粗细', '.artist-block .text-value', 500);

    addSectionTitle('Venue (THEATER MILANO-Za)');
    createControl('顶部距离', '.venue-block', 'marginTop', -50, 50, 1, 'px', -2);
    createControl('左边距', '.venue-block', 'marginLeft', -50, 100, 1, 'px', -8);
    createControl('字体大小', '.venue-block .text-value', 'fontSize', 10, 30, 1, 'px', 15);
    createWeightControl('字体粗细', '.venue-block .text-value', 500);

    addSectionTitle('Date (2025/11/26)');
    createControl('顶部距离', '.date-block', 'marginTop', -50, 50, 1, 'px', -2);
    createControl('左边距', '.date-block', 'marginLeft', -50, 100, 1, 'px', -8);
    createControl('字体大小', '.date-text', 'fontSize', 10, 40, 1, 'px', 16);
    createWeightControl('字体粗细', '.date-text', 500);

    addSectionTitle('Time (Open/Start)');
    createControl('顶部距离', '.time-row', 'marginTop', -50, 50, 1, 'px', -1);
    createControl('左边距', '.time-row', 'marginLeft', -50, 100, 1, 'px', -8);
    createControl('行间隔', '.time-row', 'gap', 0, 100, 1, 'px', 29);
    createControlMultiple('字体大小', '.time-row .text-value', 'fontSize', 10, 40, 1, 'px', 16);
    createWeightControlMultiple('字体粗细', '.time-row .text-value', 500);

    addSectionTitle('Name (XIE JIAJIE)');
    createControl('顶部距离', '.name-block', 'marginTop', -50, 100, 1, 'px', -9);
    createControl('左边距', '.name-block', 'marginLeft', -50, 100, 1, 'px', -8);
    createControl('字体大小', '.name-text', 'fontSize', 10, 40, 1, 'px', 15);
    createWeightControl('字体粗细', '.name-text', 500);

    addSectionTitle('Seat (座位)');
    createControl('顶部距离', '.seat-block', 'marginTop', -50, 50, 1, 'px', -10);
    createControl('左边距', '.seat-block', 'marginLeft', -50, 100, 1, 'px', -8);
    createControl('字体大小', '.seat-text', 'fontSize', 10, 40, 1, 'px', 16);
    createWeightControl('字体粗细', '.seat-text', 500);

    addSectionTitle('Stamp (印章)');
    createControl('垂直位置 (Top)', '.stamp', 'top', 0, 80, 1, '%', 9);
    createControl('水平位置 (Right)', '.stamp', 'right', -20, 50, 1, '%', 9);
    createControl('大小', '.stamp', 'width', 10, 80, 1, '%', 42);

    // Rotation control
    const rotContainer = document.createElement('div');
    rotContainer.style.marginBottom = '8px';
    const rotLabel = document.createElement('div');
    rotLabel.style.display = 'flex';
    rotLabel.style.justifyContent = 'space-between';
    rotLabel.style.marginBottom = '3px';
    rotLabel.innerHTML = '<span>旋转角度</span><span id="rotVal" style="color:#afeeee;">0deg</span>';
    const rotInput = document.createElement('input');
    rotInput.type = 'range';
    rotInput.min = -45;
    rotInput.max = 45;
    rotInput.step = 1;
    rotInput.value = 0;
    rotInput.style.width = '100%';
    rotInput.oninput = (e) => {
        const val = e.target.value;
        document.getElementById('rotVal').textContent = val + 'deg';
        const stamp = document.querySelector('.stamp');
        if (stamp && stamp.classList.contains('active')) {
            stamp.style.transform = `scale(1) rotate(${val}deg)`;
        }
    };
    rotContainer.appendChild(rotLabel);
    rotContainer.appendChild(rotInput);
    gui.appendChild(rotContainer);

})();
