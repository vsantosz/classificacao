;

// --- VARIAVEIS GLOBAIS ---
var CONFIG_VAGAS = { 'AC': 161, 'PN': 63, 'PCD': 13, 'PI': 8, 'PQ': 5 };
var CONFIG_PAGE_SIZE = 50;
var allData = [];
var calculatedData = [];
var currentViewList = [];
var renderedCount = 0;
var chartDist = null;
var chartStatus = null;
var compareChart = null;
var radarChart = null;
var searchTimeout = null;
var quickFilter = 'ALL';
var userApiKey = localStorage.getItem('gemini_api_key') || "";
var appGeminiKey = SYSTEM_API_KEY;
var selectedForCompare = [];
var compareMode = false;
var currentModalCandidate = null;
var favorites = JSON.parse(localStorage.getItem('cnu_favs') || '[]');
var excludedIds = JSON.parse(localStorage.getItem('cnu_excluded') || '[]');
var currentSort = { key: 'total_score', order: 'desc' };

// --- GLOBAL EXPORTS ---

// --- DONATION POPUP ---
window.copyPix = function () {
    var pixKey = document.getElementById('pixKey').innerText;
    navigator.clipboard.writeText(pixKey).then(function () {
        var copied = document.getElementById('pixCopied');
        copied.classList.remove('hidden');
        setTimeout(function () { copied.classList.add('hidden'); }, 2000);
    }).catch(function () {
        // Fallback for older browsers
        var temp = document.createElement('textarea');
        temp.value = pixKey;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
        var copied = document.getElementById('pixCopied');
        copied.classList.remove('hidden');
        setTimeout(function () { copied.classList.add('hidden'); }, 2000);
    });
};

window.closeDonation = function () {
    var popup = document.getElementById('donationPopup');
    popup.style.opacity = '0';
    setTimeout(function () {
        popup.classList.add('hidden');
        popup.style.opacity = '';
    }, 300);
    localStorage.setItem('cnu_donation_shown', 'true');
};

window.showDonationIfNeeded = function () {
    if (!localStorage.getItem('cnu_donation_shown')) {
        setTimeout(function () {
            var popup = document.getElementById('donationPopup');
            popup.classList.remove('hidden');
        }, 1500);
    }
};

window.acceptDisclaimer = function () {
    document.getElementById('introScreen').style.opacity = '0';
    setTimeout(function () {
        document.getElementById('introScreen').style.display = 'none';
        document.getElementById('mainLayout').style.opacity = '1';
        checkDataAvailability();
        // Show donation popup on first visit only
        showDonationIfNeeded();
    }, 500);
};

window.toggleMobileMenu = function () {
    var menu = document.getElementById('mobileMenu');
    if (menu.classList.contains('hidden')) {
        menu.classList.remove('hidden');
        menu.classList.add('flex');
    } else {
        menu.classList.add('hidden');
        menu.classList.remove('flex');
    }
};

// --- SIMULATOR & SETTINGS ---
window.toggleSettings = function () {
    var modal = document.getElementById('settingsModal');
    var overlay = document.getElementById('settingsOverlay');
    var content = document.getElementById('settingsContent');

    if (modal.classList.contains('hidden')) {
        document.getElementById('set_ac').value = CONFIG_VAGAS.AC;
        document.getElementById('set_pn').value = CONFIG_VAGAS.PN;
        document.getElementById('set_pcd').value = CONFIG_VAGAS.PCD;
        document.getElementById('set_pi').value = CONFIG_VAGAS.PI;
        document.getElementById('set_pq').value = CONFIG_VAGAS.PQ;

        modal.classList.remove('hidden', 'pointer-events-none');
        requestAnimationFrame(function () {
            overlay.style.opacity = '1';
            content.classList.remove('scale-95', 'opacity-0');
        });
    } else {
        overlay.style.opacity = '0';
        content.classList.add('scale-95', 'opacity-0');
        setTimeout(function () { modal.classList.add('hidden', 'pointer-events-none'); }, 300);
    }
};

window.applySettings = function () {
    var rate = parseInt(document.getElementById('abstentionRange').value) || 0;
    var multiplier = 1 + (rate / 100);

    CONFIG_VAGAS.AC = Math.ceil((parseInt(document.getElementById('set_ac').value) || 161) * multiplier);
    CONFIG_VAGAS.PN = Math.ceil((parseInt(document.getElementById('set_pn').value) || 63) * multiplier);
    CONFIG_VAGAS.PCD = Math.ceil((parseInt(document.getElementById('set_pcd').value) || 13) * multiplier);
    CONFIG_VAGAS.PI = Math.ceil((parseInt(document.getElementById('set_pi').value) || 8) * multiplier);
    CONFIG_VAGAS.PQ = Math.ceil((parseInt(document.getElementById('set_pq').value) || 5) * multiplier);

    document.getElementById('vagasInput').value = CONFIG_VAGAS.AC;

    window.toggleSettings();
    processCascading();
    updateView();
    alert("Simulação aplicada com taxa de abstenção de " + rate + "%!");
};

// --- EXCLUSION / GOD MODE ---
window.toggleExclusion = function () {
    if (!currentModalCandidate) return;
    var id = currentModalCandidate.id;
    var idx = excludedIds.indexOf(id);

    if (idx > -1) {
        excludedIds.splice(idx, 1);
        alert("Candidato reativado.");
    } else {
        excludedIds.push(id);
        alert("Candidato marcado como desistente.");
    }
    localStorage.setItem('cnu_excluded', JSON.stringify(excludedIds));
    processCascading();
    updateView();
    window.closeModal();
};

// --- SHARE CARD ---
window.generateShareCard = function () {
    if (!currentModalCandidate) return;
    var c = currentModalCandidate;

    // Populate Canvas
    document.getElementById('scName').innerText = c.name;
    document.getElementById('scPos').innerText = "#" + c.pos_geral + " Geral";
    document.getElementById('scTotal').innerText = c.total_score.toFixed(2);
    document.getElementById('scStatus').innerText = c.computedStatus.label;

    // Status Colors
    var stLabel = document.getElementById('scStatus');
    stLabel.className = "text-sm font-bold uppercase tracking-wider ";
    if (c.computedStatus.label.includes('VAGA')) stLabel.className += "text-emerald-600";
    else if (c.computedStatus.label.includes('CR')) stLabel.className += "text-sky-600";
    else stLabel.className += "text-slate-500";

    var node = document.getElementById('shareCardContainer');
    // Ensure styles for capture
    node.style.display = 'block';

    html2canvas(node, {
        scale: 2, // Retina quality
        backgroundColor: null,
        useCORS: true
    }).then(function (canvas) {
        var link = document.createElement('a');
        link.download = 'resultado_cnu_' + c.name.split(' ')[0] + '.png';
        link.href = canvas.toDataURL("image/png");
        link.click();
        showToast("Imagem salva! Pode postar! 📸", "success");
    }).catch(function (err) {
        console.error(err);
        alert("Erro ao gerar imagem.");
    });
};

// --- NEIGHBOR MODE (Vizinhos) ---
window.triggerSniperMode = function () {
    if (!currentModalCandidate) return;
    var idx = currentViewList.findIndex(c => c.id === currentModalCandidate.id);
    if (idx === -1) return;

    var start = Math.max(0, idx - 5);
    var end = Math.min(currentViewList.length, idx + 6);

    // Extract Neighbors
    var snippet = currentViewList.slice(start, end);
    var ids = snippet.map(c => c.id);

    // Apply Filter
    document.getElementById('searchInput').value = ""; // Clear search
    currentViewList = calculatedData.filter(c => ids.includes(c.id));
    window.currentRenderData = currentViewList; // Sync for export

    // Update view mechanics
    renderedCount = 0;
    document.getElementById('tableBody').innerHTML = '';
    renderBatch();

    // Feedback
    window.closeModal();
    showToast("Modo Vizinhos Ativado! 🕵️", "success");

    // Add visually distinct header or reset button logic? 
    // For now, the user can simple click "Todos" or change filter to reset.
};

// --- SORTING ---
window.sortData = function (key) {
    if (currentSort.key === key) {
        currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.key = key;
        currentSort.order = 'desc';
    }

    currentViewList.sort(function (a, b) {
        var valA = a[key];
        var valB = b[key];
        if (typeof valA === 'string') {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
        }
        if (valA < valB) return currentSort.order === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.order === 'asc' ? 1 : -1;
        return 0;
    });

    renderedCount = 0;
    document.getElementById('tableBody').innerHTML = '';
    renderBatch();
};

// --- FAVORITES ---
window.toggleFavorite = function (id, event) {
    if (event) event.stopPropagation();
    var idx = favorites.indexOf(id);
    if (idx > -1) favorites.splice(idx, 1);
    else favorites.push(id);
    localStorage.setItem('cnu_favs', JSON.stringify(favorites));

    var star = document.getElementById('star-' + id);
    if (star) {
        if (star.classList.contains('fa-regular')) {
            star.classList.remove('fa-regular');
            star.classList.add('fa-solid', 'active');
        } else {
            star.classList.remove('fa-solid', 'active');
            star.classList.add('fa-regular');
        }
    }
    if (document.getElementById('viewFilter').value === 'FAV') updateView();
};

// --- VISUAL SHARE ---
window.generateShareImage = function () {
    if (!currentModalCandidate) return;
    var c = currentModalCandidate;

    document.getElementById('scName').innerText = c.name;
    document.getElementById('scPos').innerText = '#' + c.pos_geral;
    document.getElementById('scTotal').innerText = c.total_score.toFixed(2);
    document.getElementById('scStatus').innerText = c.computedStatus.label;

    var node = document.getElementById('shareCardContainer');

    html2canvas(node).then(function (canvas) {
        var link = document.createElement('a');
        link.download = 'Resultado_' + c.name.split(' ')[0] + '.png';
        link.href = canvas.toDataURL();
        link.click();
    });
};

window.toggleDarkMode = function () {
    var html = document.documentElement;
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        localStorage.setItem('theme', 'light');
    } else {
        html.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    }
    updateCharts();
};

// Check theme on load
if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
} else {
    document.documentElement.classList.remove('dark');
}

window.setQuickFilter = function (type) {
    quickFilter = type;
    ['ALL', 'VAGA', 'CR'].forEach(function (k) {
        var btn = document.getElementById('qf-' + k);
        if (k === type) btn.className = "px-3 py-1.5 rounded text-[10px] font-bold uppercase transition-all bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm transform scale-105";
        else btn.className = "px-3 py-1.5 rounded text-[10px] font-bold uppercase text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-all";
    });
    renderedCount = 0;
    document.getElementById('tableBody').innerHTML = '';
    renderBatch();
};

window.toggleCompareMode = function () {
    compareMode = !compareMode;
    selectedForCompare = [];
    var btn = document.getElementById('compareModeBtn');
    var fab = document.getElementById('fabCompare');
    var th = document.getElementById('colCompare');

    if (compareMode) {
        btn.classList.add('bg-indigo-100', 'text-indigo-700', 'border-indigo-300');
        if (fab) fab.classList.remove('scale-0');
        th.classList.remove('hidden');
    } else {
        btn.classList.remove('bg-indigo-100', 'text-indigo-700', 'border-indigo-300');
        if (fab) fab.classList.add('scale-0');
        th.classList.add('hidden');
    }
    document.getElementById('tableBody').innerHTML = '';
    renderedCount = 0;
    renderBatch();
};

window.executeComparison = function () {
    if (selectedForCompare.length < 2) return alert("Selecione 2 candidatos.");
    var c1 = calculatedData.find(function (c) { return c.id === selectedForCompare[0]; });
    var c2 = calculatedData.find(function (c) { return c.id === selectedForCompare[1]; });

    var fillComp = function (elId, c) {
        document.getElementById(elId).innerHTML =
            '<div class="font-bold text-sm truncate">' + c.name + '</div>' +
            '<div class="text-[10px] text-slate-500 mb-2">#' + c.pos_geral + '</div>' +
            '<div class="text-2xl font-black text-indigo-700">' + c.total_score.toFixed(2) + '</div>';
    };
    fillComp('comp1', c1);
    fillComp('comp2', c2);

    var ctx = document.getElementById('compareChart').getContext('2d');
    if (compareChart) compareChart.destroy();
    compareChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Específica', 'Discursiva', 'Total'],
            datasets: [
                { label: c1.name.split(' ')[0], data: [c1.esp_score, c1.disc_score, c1.total_score], backgroundColor: '#6366f1' },
                { label: c2.name.split(' ')[0], data: [c2.esp_score, c2.disc_score, c2.total_score], backgroundColor: '#d946ef' }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: false } }
        }
    });

    var modal = document.getElementById('compareModal');
    var overlay = document.getElementById('compareOverlay');
    var content = document.getElementById('compareContent');
    modal.classList.remove('hidden', 'pointer-events-none');
    setTimeout(function () { overlay.style.opacity = '1'; content.classList.remove('scale-95', 'opacity-0'); }, 10);
};

window.closeCompare = function () {
    var modal = document.getElementById('compareModal');
    document.getElementById('compareOverlay').style.opacity = '0';
    document.getElementById('compareContent').classList.add('scale-95', 'opacity-0');
    setTimeout(function () { modal.classList.add('hidden', 'pointer-events-none'); }, 300);
};

window.toggleAI = function () {
    var modal = document.getElementById('aiModal');
    var overlay = document.getElementById('aiOverlay');
    var content = document.getElementById('aiContent');

    if (modal.classList.contains('hidden')) {
        modal.classList.remove('hidden', 'pointer-events-none');
        requestAnimationFrame(function () {
            overlay.style.opacity = '1';
            content.classList.remove('scale-95', 'opacity-0');
            content.classList.add('scale-100', 'opacity-100');
        });
        if (!userApiKey && !appGeminiKey) {
            document.getElementById('apiKeyConfig').classList.remove('hidden');
        }
    } else {
        overlay.style.opacity = '0';
        content.classList.remove('scale-100', 'opacity-100');
        content.classList.add('scale-95', 'opacity-0');
        setTimeout(function () { modal.classList.add('hidden', 'pointer-events-none'); }, 300);
    }
};

window.saveApiKey = function () {
    var val = document.getElementById('apiKeyInput').value.trim();
    if (val) {
        userApiKey = val;
        localStorage.setItem('gemini_api_key', val);
        document.getElementById('apiKeyConfig').classList.add('hidden');
        addAiMessage("bot", "Chave API salva! Agora você pode me fazer perguntas sobre os dados.");
    }
};

window.sendToAI = async function () {
    var input = document.getElementById('aiInput');
    var question = input.value.trim();
    if (!question) return;

    var keyToUse = userApiKey || appGeminiKey;
    if (!keyToUse) {
        addAiMessage("bot", "⚠️ Por favor, insira sua Google API Key nas configurações acima para usar a IA.");
        document.getElementById('apiKeyConfig').classList.remove('hidden');
        return;
    }

    addAiMessage("user", question);
    input.value = '';

    var loadingDiv = document.createElement('div');
    loadingDiv.className = "ai-message bot flex items-center gap-2";
    loadingDiv.innerHTML = '<div class="typing-dot"></div><div class="typing-dot" style="animation-delay: 0.1s"></div><div class="typing-dot" style="animation-delay: 0.2s"></div>';
    loadingDiv.id = "aiLoading";
    document.getElementById('aiChatArea').appendChild(loadingDiv);

    var stats = {
        total: allData.length,
        filtered: currentViewList.length,
        cutVaga: document.getElementById('kpiCutVaga').innerText
    };
    var top5 = currentViewList.slice(0, 5).map(function (c) {
        return c.pos_geral + '. ' + c.name + ' (' + c.total_score + ') - ' + c.computedStatus.label;
    }).join('\n');

    var prompt =
        'Contexto: Painel de Classificação CNU Bloco 7 (Justiça e Defesa).\n' +
        'Dados Atuais:\n' +
        '- Total Candidatos Carregados: ' + stats.total + '\n' +
        '- Visualização Atual: ' + document.getElementById('viewFilter').value + '\n' +
        '- Nota Corte (Geral/AC estimativa): ' + document.getElementById('kpiCutVaga').innerText + '\n' +
        '- Top 5 da lista atual:\n' + top5 + '\n' +
        'Pergunta do usuário: "' + question + '"\n' +
        'Responda de forma concisa, analítica e em Português do Brasil. Use formatação Markdown.';

    try {
        var response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=' + keyToUse, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        var data = await response.json();
        document.getElementById('aiLoading').remove();

        if (data.error) {
            addAiMessage("bot", '❌ Erro na API: ' + data.error.message);
        } else {
            var text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Não consegui gerar uma resposta.";
            addAiMessage("bot", text);
        }
    } catch (e) {
        document.getElementById('aiLoading').remove();
        addAiMessage("bot", "❌ Erro de conexão. Verifique sua internet.");
    }
};

window.shareApp = function () {
    var shareData = {
        title: 'Painel CNU - Bloco 7',
        text: 'Confira a classificação detalhada do CNU Bloco 7 - Justiça e Defesa.',
        url: window.location.href,
    };
    if (navigator.share) navigator.share(shareData).catch(console.error);
    else {
        var url = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(shareData.text + ' ' + shareData.url);
        window.open(url, '_blank');
    }
};

window.saveOfflineHTML = function () {
    if (allData.length === 0) return alert("Carregue dados primeiro.");
    var htmlContent = document.documentElement.outerHTML;
    var dataString = JSON.stringify(allData);
    // Substitui apenas o conteúdo do script de dados, mantendo a estrutura segura
    var scriptTag = '<script id="json-data" type="application/json">' + dataString + '<\/script>';
    // Regex ajustado para ser mais tolerante
    htmlContent = htmlContent.replace(/<script id="json-data" type="application\/json">([\s\S]*?)<\/script>/, scriptTag);
    var blob = new Blob([htmlContent], { type: 'text/html' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'Painel_CNU_All_In_One.html'; a.click();
};

window.clearData = function () { localStorage.removeItem('cnu_v16_data'); location.reload(); };

window.closeModal = function () {
    var modal = document.getElementById('detailModal');
    var content = document.getElementById('modalContent');
    var overlay = document.getElementById('modalOverlay');

    overlay.style.opacity = '0';
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');

    setTimeout(function () {
        modal.classList.add('hidden', 'pointer-events-none');
    }, 300);
};

window.shareCandidateResult = function () {
    if (!currentModalCandidate) return;
    var c = currentModalCandidate;
    var name = c.name;
    var pos = '#' + c.pos_geral; // Use Global Position always
    var total = c.total_score.toFixed(2);
    var text = 'Confira o resultado de ' + name + ' no CNU Bloco 7:\n🏆 Posição Geral: ' + pos + '\n📊 Nota Final: ' + total + '\n\nVia Painel CNU: ' + window.location.href;
    window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(text), '_blank');
};

window.exportCSV = function () {
    var headers = ['Pos', 'Geral', 'Nome', 'Inscricao', 'Nota Final', 'Especifica', 'Discursiva', 'Cotas', 'Situacao'];
    var rows = currentViewList.map(function (c, i) {
        return [
            i + 1,
            c.pos_geral,
            '"' + c.name + '"',
            c.id,
            c.total_score.toFixed(2).replace('.', ','),
            c.esp_score.toFixed(2).replace('.', ','),
            c.disc_score.toFixed(2).replace('.', ','),
            '"' + c.cotas.join(', ') + '"',
            '"' + c.computedStatus.label + '"'
        ].join(';');
    });

    var csvContent = "data:text/csv;charset=utf-8," + headers.join(";") + "\n" + rows.join("\n");
    var encodedUri = encodeURI(csvContent);
    var link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", 'CNU_Bloco7_Export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.exportPDF = function () {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF();

    // 1. Cabeçalho Minimalista
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, 210, 35, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Painel CNU - Bloco 7", 14, 18);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Justiça e Defesa - Classificação Extraoficial", 14, 26);

    var filterName = document.getElementById('viewFilter').options[document.getElementById('viewFilter').selectedIndex].text;
    var dateStr = new Date().toLocaleDateString('pt-BR');
    doc.setFontSize(9);
    // --- CORREÇÃO DE EMOJI NO PDF ---
    // Remove caracteres que não são texto/número/pontuação básica (remove emojis)
    var cleanFilterName = filterName.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim();
    doc.text('Lista: ' + cleanFilterName, 196, 18, { align: 'right' });
    doc.text('Gerado em: ' + dateStr, 196, 26, { align: 'right' });

    var rows = currentViewList.map(function (c, i) {
        return [
            i + 1,
            c.pos_geral,
            c.id,
            c.name,
            c.cotas.filter(function (x) { return x != 'AC'; }).join(', ') || '-',
            c.computedStatus.label,
            c.total_score.toFixed(2)
        ];
    });

    doc.autoTable({
        head: [['#', 'Geral', 'Inscrição', 'Nome', 'Cotas', 'Situação', 'Nota']],
        body: rows,
        startY: 40,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 3, font: "helvetica", lineColor: [229, 231, 235], lineWidth: 0.1 },
        headStyles: { fillColor: [255, 255, 255], textColor: [79, 70, 229], fontStyle: 'bold', lineWidth: 0.1, lineColor: [229, 231, 235] },
        columnStyles: {
            0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
            1: { cellWidth: 12, halign: 'center' },
            2: { cellWidth: 28, halign: 'center', font: 'courier' },
            3: { cellWidth: 'auto' },
            4: { cellWidth: 20 },
            5: { cellWidth: 30, halign: 'center', fontStyle: 'bold' },
            6: { cellWidth: 15, halign: 'right', fontStyle: 'bold', textColor: [67, 56, 202] }
        },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        didParseCell: function (data) {
            if (data.section === 'body' && data.column.index === 5) {
                var text = data.cell.raw;
                if (text.includes('VAGA')) data.cell.styles.textColor = [22, 163, 74];
                else if (text.includes('CR')) data.cell.styles.textColor = [2, 132, 199];
                else { data.cell.styles.textColor = [156, 163, 175]; data.cell.styles.fontStyle = 'normal'; }
            }
        },
        didDrawPage: function (data) {
            var pageCount = doc.internal.getNumberOfPages();
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text('Página ' + pageCount, data.settings.margin.left, doc.internal.pageSize.height - 10);
            doc.text('Painel CNU', 196, doc.internal.pageSize.height - 10, { align: 'right' });
        }
    });

    doc.save('CNU_' + filterName.replace(/\s+/g, '_') + '.pdf');
};

window.loadFromText = function () {
    var txt = document.getElementById('jsonTextInput').value;
    if (!txt.trim()) return alert("Cole o JSON.");
    processJSON(txt);
};

window.switchTab = function (tab) {
    var btnFile = document.getElementById('tabFile');
    var btnText = document.getElementById('tabText');
    var activeClass = "flex-1 py-4 text-xs font-bold uppercase tracking-wide text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30 dark:bg-indigo-900/20";
    var inactiveClass = "flex-1 py-4 text-xs font-bold uppercase tracking-wide text-slate-400 hover:text-indigo-600 transition-colors";

    btnFile.className = tab === 'file' ? activeClass : inactiveClass;
    btnText.className = tab === 'text' ? activeClass : inactiveClass;
    document.getElementById('panelFile').classList.toggle('hidden', tab !== 'file');
    document.getElementById('panelFile').classList.toggle('flex', tab === 'file');
    document.getElementById('panelText').classList.toggle('hidden', tab !== 'text');
    document.getElementById('panelText').classList.toggle('flex', tab === 'text');
};

window.toggleSidebar = function () {
    var sidebar = document.getElementById('sidebarContainer');
    var btn = document.getElementById('btnToggleCharts');
    if (sidebar.classList.contains('hidden')) {
        sidebar.classList.remove('hidden'); sidebar.classList.add('flex');
        btn.classList.add('bg-indigo-100', 'text-indigo-600', 'border-indigo-200'); btn.classList.remove('bg-white', 'text-slate-600', 'border-slate-200');
    } else {
        sidebar.classList.add('hidden'); sidebar.classList.remove('flex');
        btn.classList.remove('bg-indigo-100', 'text-indigo-600', 'border-indigo-200'); btn.classList.add('bg-white', 'text-slate-600', 'border-slate-200');
    }
};

window.clearSearch = function () {
    document.getElementById('searchInput').value = '';
    toggleClearBtn();
    handleSearchInput();
    document.getElementById('searchInput').focus();
};

window.handleSearchInput = function () {
    toggleClearBtn();
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(function () {
        document.getElementById('tableBody').innerHTML = '';
        renderedCount = 0;
        renderBatch();
    }, 150);
};

window.scrollToTop = function () { document.getElementById('tableContainer').scrollTo({ top: 0, behavior: 'smooth' }); };
window.scrollToBottom = function () {
    var container = document.getElementById('tableContainer');
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
};

// --- LÓGICA DO STICKY TRACKER ---
var trackedCandidate = null;

window.toggleTracker = function () {
    if (!currentModalCandidate) return;

    trackedCandidate = currentModalCandidate;

    // Preenche os dados na barra fixa
    document.getElementById('stName').innerText = trackedCandidate.name;
    document.getElementById('stPos').innerText = '#' + trackedCandidate.pos_geral;
    document.getElementById('stScore').innerText = trackedCandidate.total_score.toFixed(2);
    document.getElementById('stStatus').innerText = trackedCandidate.computedStatus.label;

    // Mostra a barra (remove o translate que a escondia)
    document.getElementById('stickyTracker').classList.remove('translate-y-full');

    // Feedback visual e fecha modal
    // alert("Candidato fixado no rodapé!"); // Opcional
    window.closeModal();
};

window.closeTracker = function () {
    trackedCandidate = null;
    document.getElementById('stickyTracker').classList.add('translate-y-full');
};

window.initApp = function () {
    // --- DEEP LINKING: LER URL ---
    var urlParams = new URLSearchParams(window.location.search);
    var viewParam = urlParams.get('view');
    var searchParam = urlParams.get('q');

    if (viewParam) {
        var select = document.getElementById('viewFilter');
        if (select.querySelector('option[value="' + viewParam + '"]')) {
            select.value = viewParam;
        }
    }
    if (searchParam) {
        document.getElementById('searchInput').value = searchParam;
        toggleClearBtn();
    }
    // -----------------------------
    document.getElementById('uploadScreen').classList.add('hidden');
    document.getElementById('uploadScreen').classList.add('hidden');
    document.getElementById('dashboardScreen').classList.remove('hidden');
    document.getElementById('dashboardScreen').classList.add('flex');
    document.getElementById('statusBadge').classList.remove('hidden');
    document.getElementById('statusBadge').classList.add('flex');
    document.getElementById('dbCount').innerText = allData.length;

    allData.sort(function (a, b) {
        if (b.total_score !== a.total_score) return b.total_score - a.total_score;
        if ((b.esp_score || 0) !== (a.esp_score || 0)) return (b.esp_score || 0) - (a.esp_score || 0);
        if ((b.disc_score || 0) !== (a.disc_score || 0)) return (b.disc_score || 0) - (a.disc_score || 0);
        return (b.geral_score || 0) - (a.geral_score || 0);
    });

    processCascading();
    setupIntersectionObserver();

    // Resume Identity if available
    if (localStorage.getItem('cnu_my_id')) {
        myIdentityId = localStorage.getItem('cnu_my_id');
        updateHeroDashboard();
    }

    updateView();
};

window.updateView = function () {
    var select = document.getElementById('viewFilter');
    var filter = select.value;
    var inputVagas = document.getElementById('vagasInput');

    // Deep Linking (Atualiza URL)
    var url = new URL(window.location);
    url.searchParams.set('view', filter);
    window.history.replaceState({}, '', url);

    if (CONFIG_VAGAS[filter]) inputVagas.value = CONFIG_VAGAS[filter];
    else if (filter === 'Geral' || filter === 'MEU') inputVagas.value = 250;

    document.getElementById('tableHeader').innerText = filter === 'Geral' ? 'Classificação' : 'Lista: ' + filter;

    // Reset das flags de divisores visuais
    if (window.viewDividers) window.viewDividers = { cr: false, elim: false };

    // --- LÓGICA DE FILTRAGEM (COM "MEU RESULTADO") ---
    if (filter === 'Geral') {
        currentViewList = [].concat(calculatedData);
    }
    else if (filter === 'MEU') {
        // Verifica se o usuário já definiu quem ele é
        if (!myIdentityId) {
            alert("⚠️ Identidade não definida!\n\n1. Encontre seu nome na lista.\n2. Clique nele para ver os detalhes.\n3. Clique no botão 'Sou Eu'.");
            select.value = 'Geral'; // Volta para Geral
            return updateView();
        }
        // Filtra apenas o ID definido
        currentViewList = calculatedData.filter(function (c) { return c.id === myIdentityId; });
    }
    else if (filter === 'FAV') {
        currentViewList = calculatedData.filter(function (c) { return favorites.includes(c.id); });
    }
    else {
        currentViewList = calculatedData.filter(function (c) { return c.cotas.includes(filter); });
    }

    updateKPIs(filter);
    updateCharts();

    window.currentRenderData = currentViewList;

    document.getElementById('tableBody').innerHTML = '';
    renderedCount = 0;
    renderBatch();
};

window.updateVagasManual = function () {
    var val = parseInt(document.getElementById('vagasInput').value) || 0;
    CONFIG_VAGAS.AC = val;
    processCascading();
    updateView();
};

var lastUpdateEl = document.getElementById('lastUpdateDate');
if (lastUpdateEl) lastUpdateEl.innerText = new Date().toLocaleDateString('pt-BR');

function toggleSelectCandidate(id) {
    if (selectedForCompare.includes(id)) {
        selectedForCompare = selectedForCompare.filter(function (i) { return i !== id; });
    } else {
        if (selectedForCompare.length >= 2) {
            var removedId = selectedForCompare.shift();
            updateRowVisuals(removedId, false);
        }
        selectedForCompare.push(id);
    }
    var isSelected = selectedForCompare.includes(id);
    updateRowVisuals(id, isSelected);
    if (selectedForCompare.length === 2) setTimeout(executeComparison, 500);
}

function updateRowVisuals(id, isSelected) {
    var row = document.getElementById('tr-' + id);
    if (!row) return;
    if (isSelected) {
        row.classList.add('bg-indigo-50', 'dark:bg-indigo-900/40');
    } else {
        row.classList.remove('bg-indigo-50', 'dark:bg-indigo-900/40');
    }
    var checkbox = row.querySelector('.custom-checkbox');
    if (checkbox) checkbox.checked = isSelected;
}

window.closeCompare = function () {
    var modal = document.getElementById('compareModal');
    var overlay = document.getElementById('compareOverlay');
    var content = document.getElementById('compareContent');

    overlay.style.opacity = '0';
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');

    setTimeout(function () {
        modal.classList.add('hidden', 'pointer-events-none');
        // Reset selection
        selectedForCompare.forEach(function (id) { updateRowVisuals(id, false); });
        selectedForCompare = [];
        window.compareMode = false;
        document.getElementById('compareModeBtn').classList.remove('bg-indigo-100', 'text-indigo-700', 'border-indigo-300');
        updateView();
    }, 300);
};

function executeComparison() {
    if (selectedForCompare.length < 2) return;
    var c1 = calculatedData.find(function (c) { return c.id === selectedForCompare[0]; });
    var c2 = calculatedData.find(function (c) { return c.id === selectedForCompare[1]; });

    if (!c1 || !c2) return;

    // Populate Data
    var populateComp = function (prefix, c) {
        document.getElementById(prefix + 'Name').innerText = c.name;
        document.getElementById(prefix + 'Pos').innerText = '#' + c.pos_geral;
        document.getElementById(prefix + 'Geral').innerText = c.geral_score.toFixed(2);
        document.getElementById(prefix + 'Esp').innerText = c.esp_score.toFixed(2);
        document.getElementById(prefix + 'Disc').innerText = c.disc_score.toFixed(2);
        document.getElementById(prefix + 'Tit').innerText = c.titulos_score.toFixed(2);
        document.getElementById(prefix + 'Final').innerText = c.total_score.toFixed(2);
    };

    populateComp('comp1', c1);
    populateComp('comp2', c2);

    // Diff
    var diff = (c1.total_score - c2.total_score).toFixed(2);
    var diffEl = document.getElementById('compDiff');
    if (diff > 0) {
        diffEl.innerText = "+" + diff + " para " + c1.name.split(' ')[0];
        diffEl.className = "text-center font-bold text-indigo-600 dark:text-indigo-400 mt-4";
    } else if (diff < 0) {
        diffEl.innerText = "+" + Math.abs(diff) + " para " + c2.name.split(' ')[0];
        diffEl.className = "text-center font-bold text-purple-600 dark:text-purple-400 mt-4";
    } else {
        diffEl.innerText = "Empate Técnico";
        diffEl.className = "text-center font-bold text-slate-500 dark:text-slate-400 mt-4";
    }

    // Modal
    var modal = document.getElementById('compareModal');
    var overlay = document.getElementById('compareOverlay');
    var content = document.getElementById('compareContent');

    modal.classList.remove('hidden', 'pointer-events-none');
    requestAnimationFrame(function () {
        overlay.style.opacity = '1';
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    });

    // Render Chart
    setTimeout(function () { renderCompareChart(c1, c2); }, 300);
}

var chartCompare = null;
function renderCompareChart(c1, c2) {
    var ctx = document.getElementById('compareChart').getContext('2d');
    if (chartCompare) chartCompare.destroy();

    var isDark = document.documentElement.classList.contains('dark');
    var textColor = isDark ? '#cbd5e1' : '#64748b';

    chartCompare = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Específicos', 'Discursiva', 'Títulos', 'Total'],
            datasets: [
                {
                    label: c1.name.split(' ')[0],
                    data: [c1.esp_score, c1.disc_score, c1.titulos_score, c1.total_score],
                    backgroundColor: 'rgba(79, 70, 229, 0.8)',
                    borderColor: '#4f46e5',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: c2.name.split(' ')[0],
                    data: [c2.esp_score, c2.disc_score, c2.titulos_score, c2.total_score],
                    backgroundColor: 'rgba(147, 51, 234, 0.8)',
                    borderColor: '#9333ea',
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: textColor, font: { weight: 'bold' } } },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { color: isDark ? '#333' : '#e2e8f0' },
                    ticks: { color: textColor }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: textColor, font: { size: 10, weight: 'bold' } }
                }
            }
        }
    });
}

function addAiMessage(role, text) {
    var area = document.getElementById('aiChatArea');
    var div = document.createElement('div');
    div.className = 'ai-message ' + role + ' shadow-sm border border-slate-200 dark:border-slate-800';
    div.innerHTML = marked.parse(text);
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
}

function toggleClearBtn() {
    var val = document.getElementById('searchInput').value;
    var btn = document.getElementById('clearSearchBtn');
    if (val.length > 0) btn.classList.remove('hidden');
    else btn.classList.add('hidden');
}

function checkDataAvailability() {
    // 1. Check for Global Data from database.js (Preferred for Local/CORS support)
    if (window.DATA_DB && Array.isArray(window.DATA_DB)) {
        console.log("Fluxo: Dados carregados via window.DATA_DB (database.js)");
        allData = window.DATA_DB;
        initApp();
        return;
    }

    // 2. Check Cache
    try {
        var cached = localStorage.getItem('cnu_v16_data');
        if (cached) {
            var parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
                allData = parsed;
                initApp();
                return;
            }
        }
    } catch (e) { }

    // 3. Show Upload Screen
    document.getElementById('uploadScreen').classList.remove('hidden');
}

function processJSON(jsonString) {
    try {
        var clean = jsonString.replace(/<!--[\s\S]*?-->/g, "").trim();
        var json = JSON.parse(clean);
        if (!Array.isArray(json)) throw new Error("Inválido");
        allData = json;
        try { localStorage.setItem('cnu_v16_data', JSON.stringify(allData)); } catch (e) { }
        initApp();
    } catch (err) {
        alert("JSON Inválido. Verifique se copiou corretamente.");
        document.getElementById('loadingUpload').classList.add('hidden');
    }
}

function processCascading() {
    var filled = { 'AC': 0, 'PN': 0, 'PCD': 0, 'PI': 0, 'PQ': 0 };
    var limitAC = CONFIG_VAGAS.AC;

    calculatedData = allData.map(function (c) {
        // If excluded, mark as ignored
        if (excludedIds.includes(c.id)) {
            return Object.assign({}, c, {
                computedStatus: { type: 'st-ignore', label: 'IGNORADO' },
                isVaga: false
            });
        }

        var status = { type: 'st-elim', label: 'ELIMINADO' };
        var isVaga = false;

        if (filled.AC < limitAC) {
            status = { type: 'st-vaga', label: 'VAGA AC' };
            filled.AC++;
            isVaga = true;
        } else {
            for (var i = 0; i < ['PN', 'PCD', 'PI', 'PQ'].length; i++) {
                var q = ['PN', 'PCD', 'PI', 'PQ'][i];
                if (c.cotas.includes(q) && filled[q] < CONFIG_VAGAS[q]) {
                    if (c.status_map && c.status_map[q] === 'CONFIRMED') {
                        status = { type: 'st-vaga', label: 'VAGA ' + q };
                        filled[q]++;
                        isVaga = true;
                        break;
                    }
                }
            }
        }
        return Object.assign({}, c, { computedStatus: status, isVaga: isVaga });
    });

    var filledCR = { 'AC': 0, 'PN': 0, 'PCD': 0, 'PI': 0, 'PQ': 0 };
    var limitCR_AC = limitAC * 2;

    calculatedData.forEach(function (c) {
        if (c.isVaga || excludedIds.includes(c.id)) return;
        var isCR = false;
        if (filledCR.AC < limitCR_AC) {
            c.computedStatus = { type: 'st-cr', label: 'CR AC' };
            filledCR.AC++;
            isCR = true;
        }
        if (!isCR) {
            for (var i = 0; i < ['PN', 'PCD', 'PI', 'PQ'].length; i++) {
                var q = ['PN', 'PCD', 'PI', 'PQ'][i];
                if (c.cotas.includes(q)) {
                    if (c.status_map && c.status_map[q] === 'CONFIRMED') {
                        if (filledCR[q] < (CONFIG_VAGAS[q] * 2)) {
                            c.computedStatus = { type: 'st-cr', label: 'CR ' + q };
                            filledCR[q]++;
                            break;
                        }
                    }
                }
            }
        }
    });
}

function updateKPIs(filter) {
    var total = currentViewList.length;
    document.getElementById('kpiListTotal').innerText = total;

    var counts = {};
    currentViewList.forEach(function (c) {
        c.cotas.forEach(function (cot) {
            if (cot !== 'AC') counts[cot] = (counts[cot] || 0) + 1;
        });
    });
    var counterHtml = Object.entries(counts).map(function (e) { return e[0] + ':' + e[1]; }).join(' | ');
    document.getElementById('cotasCounter').innerText = counterHtml;

    if (total === 0) return;
    document.getElementById('kpiMax').innerText = currentViewList[0].total_score.toFixed(2);

    var targetVaga = filter === 'Geral' ? 'VAGA' : 'VAGA ' + filter;
    var targetCR = filter === 'Geral' ? 'CR' : 'CR ' + filter;
    if (filter === 'AC') { targetVaga = 'VAGA AC'; targetCR = 'CR AC'; }

    var lastVagaCandidate = [].concat(currentViewList).reverse().find(function (c) { return c.computedStatus.label.includes(targetVaga); });
    var lastCRCandidate = [].concat(currentViewList).reverse().find(function (c) { return c.computedStatus.label.includes(targetCR); });

    if (!lastVagaCandidate && filter !== 'Geral') lastVagaCandidate = [].concat(currentViewList).reverse().find(function (c) { return c.computedStatus.label.includes('VAGA'); });

    var setKPI = function (idVal, idPos, cand) {
        document.getElementById(idVal).innerText = cand ? cand.total_score.toFixed(2) : "-";
        document.getElementById(idPos).innerText = cand ? '#' + (currentViewList.indexOf(cand) + 1) : "-";
    };

    setKPI('kpiCutVaga', 'posCutVaga', lastVagaCandidate);
    setKPI('kpiCutCR', 'posCutCR', lastCRCandidate);
}

function updateCharts() {
    var isDark = document.documentElement.classList.contains('dark');
    var textColor = isDark ? '#94a3b8' : '#64748b';
    var ctxStatus = document.getElementById('statusChart').getContext('2d');
    var ctxScore = document.getElementById('scoreChart').getContext('2d');

    var counts = { VAGA: 0, CR: 0, ELIM: 0 };
    var scores = [];
    currentViewList.forEach(function (c) {
        if (c.computedStatus.label.includes('VAGA')) counts.VAGA++;
        else if (c.computedStatus.label.includes('CR')) counts.CR++;
        else counts.ELIM++;
        scores.push(c.total_score);
    });

    if (chartStatus) chartStatus.destroy();
    chartStatus = new Chart(ctxStatus, {
        type: 'doughnut',
        data: {
            labels: ['Vaga', 'CR', 'Outros'],
            datasets: [{
                data: [counts.VAGA, counts.CR, counts.ELIM],
                backgroundColor: ['#10b981', '#0ea5e9', isDark ? '#334155' : '#f1f5f9'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { position: 'right', labels: { boxWidth: 8, font: { size: 9 }, color: textColor } } } }
    });

    var minScore = Math.floor(Math.min.apply(null, scores));
    var maxScore = Math.ceil(Math.max.apply(null, scores));
    var step = 2;
    var labels = [];
    var dataBins = [];
    for (var i = minScore; i < maxScore; i += step) {
        labels.push(i + '-' + (i + step));
        dataBins.push(scores.filter(function (s) { return s >= i && s < i + step; }).length);
    }

    if (chartDist) chartDist.destroy();
    chartDist = new Chart(ctxScore, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{ label: 'Candidatos', data: dataBins, backgroundColor: '#6366f1', borderRadius: 2 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 8 }, color: textColor } }, y: { display: false } } }
    });
}

function renderBatch() {
    var tbody = document.getElementById('tableBody');
    var search = document.getElementById('searchInput').value.toLowerCase();
    var spinner = document.getElementById('spinnerIcon');
    var sentinel = document.getElementById('scrollSentinel');

    // --- RESET DAS FLAGS DE DIVISOR ---
    if (renderedCount === 0) {
        window.viewDividers = { cr: false, elim: false };
    }
    if (!window.viewDividers) window.viewDividers = { cr: false, elim: false };

    // 1. Filtragem
    var list = currentViewList.filter(function (c) {
        var matchSearch = !search || c.name.toLowerCase().includes(search) || c.id.includes(search);
        if (!matchSearch) return false;
        if (quickFilter === 'ALL') return true;
        if (quickFilter === 'VAGA') return c.computedStatus.label.includes('VAGA');
        if (quickFilter === 'CR') return c.computedStatus.label.includes('CR');
        return false;
    });

    // 2. Empty State
    if (list.length === 0) {
        document.getElementById('emptyState').classList.remove('hidden');
        sentinel.style.display = 'none';
        return;
    } else {
        document.getElementById('emptyState').classList.add('hidden');
        sentinel.style.display = 'flex';
    }

    // 3. Controle de Paginação
    if (renderedCount >= list.length) {
        sentinel.style.display = 'none';
        return;
    }
    spinner.classList.remove('hidden');

    var chunk = list.slice(renderedCount, renderedCount + CONFIG_PAGE_SIZE);
    var fragment = document.createDocumentFragment();

    chunk.forEach(function (c, i) {
        var absoluteIndex = renderedCount + i;

        // --- LÓGICA DE DIVISOR VISUAL ---
        // --- LÓGICA DE DIVISOR VISUAL REMOVIDA A PEDIDO DO USUÁRIO ---
        // Código anterior de divisores CR/Eliminados foi excluído.

        var pos = absoluteIndex + 1;

        // --- BADGES E REALOCAÇÃO ---
        var badgesInfo = '';
        var isRealocado = c.computedStatus.label === 'VAGA AC' && c.cotas.some(function (q) { return q !== 'AC'; });

        if (c.cotas.length === 1 && c.cotas[0] === 'AC') {
            badgesInfo = '<span class="badge tag-ac">AC</span>';
        } else {
            c.cotas.forEach(function (q) {
                if (q === 'AC') return;
                var st = c.status_map ? c.status_map[q] : 'NONE';
                var colorClass = 'tag-' + q.toLowerCase();
                var styleExtra = '';
                var icon = '';
                if (st === 'DENIED') { colorClass = 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'; styleExtra = 'opacity: 0.7; text-decoration: line-through;'; icon = '<i class="fa-solid fa-xmark ml-1"></i>'; }
                else if (st === 'ABSENT') { colorClass = 'bg-slate-100 dark:bg-[#262626] text-slate-400 border-slate-200 dark:border-slate-700'; styleExtra = 'opacity: 0.7;'; icon = ' (Aus)'; }
                else if (st === 'CONFIRMED') { icon = '<i class="fa-solid fa-check ml-1 text-emerald-600 dark:text-emerald-400"></i>'; }
                badgesInfo += '<span class="badge ' + colorClass + ' mr-1 mb-1" style="' + styleExtra + '" title="Status: ' + st + '">' + q + icon + '</span>';
            });
            if (isRealocado) {
                badgesInfo += '<span class="badge bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-800 mr-1 mb-1 font-bold" title="Candidato cotista classificado na Ampla Concorrência"><i class="fa-solid fa-arrow-turn-up mr-1"></i>Vaga AC</span>';
            }
        }

        var st = c.computedStatus;
        var pillClass = 'st-elim';
        if (st.label.includes('VAGA')) pillClass = 'st-vaga';
        else if (st.label.includes('CR')) pillClass = 'st-cr';
        else if (st.type === 'st-ignore') pillClass = 'st-ignore';

        var errorHtml = '';
        var errorMsgs = [];
        var checkErr = function (txt, type) { if (txt && (txt.toLowerCase().includes('não') || txt.toLowerCase().includes('ausente'))) errorMsgs.push(type); };
        checkErr(c.res_pn_text, 'PN'); checkErr(c.res_pcd_text, 'PCD'); checkErr(c.res_pi_text, 'PI'); checkErr(c.res_pq_text, 'PQ');
        if (errorMsgs.length > 0) errorHtml = '<div class="mt-0.5 text-[9px] text-red-500 dark:text-red-400 font-medium"><i class="fa-solid fa-circle-exclamation mr-1"></i>Negado: ' + errorMsgs.join(', ') + '</div>';

        var isFav = favorites.includes(c.id);
        var starClass = isFav ? "fa-solid active" : "fa-regular";
        var starIcon = '<i id="star-' + c.id + '" class="' + starClass + ' fa-star star-fav mr-1" onclick="toggleFavorite(\'' + c.id + '\', event)"></i>';

        var tr = document.createElement('tr');
        tr.className = "hover-row border-b border-slate-50 dark:border-[#262626] transition-all fade-in bg-white dark:bg-[#1a1a1a]";
        tr.id = 'tr-' + c.id;
        var isSelected = selectedForCompare.includes(c.id);
        var bgSelected = isSelected ? 'bg-indigo-50 dark:bg-indigo-900/40' : '';
        tr.className += ' ' + bgSelected;

        if (excludedIds.includes(c.id)) tr.style.opacity = '0.5';

        tr.onclick = function (e) {
            if (compareMode) { toggleSelectCandidate(c.id); e.stopPropagation(); }
            else { openModal(c, pos, pillClass); }
        };

        // --- PREPARAÇÃO DA NOTA COM ÍCONE DE EDIÇÃO ---
        var displayScore = c.total_score.toFixed(2);
        if (c.is_simulated) {
            displayScore += ' <i class="fa-solid fa-pen text-[9px] text-amber-500 ml-1" title="Nota Simulada Manualmente"></i>';
        }
        // ----------------------------------------------

        var checkHtml = '';
        if (compareMode) checkHtml = '<td class="px-3 py-2.5 text-center"><input type="checkbox" class="custom-checkbox" ' + (isSelected ? 'checked' : '') + '></td>';

        tr.innerHTML = checkHtml +
            '<td class="px-4 py-2.5 text-center font-bold text-slate-400 dark:text-slate-500 text-xs bg-slate-50/50 dark:bg-[#262626]/50">' + pos + '</td>' +
            '<td class="px-4 py-2.5 text-center text-xs text-slate-400 dark:text-slate-500 font-mono">#' + c.pos_geral + '</td>' +
            '<td class="px-4 py-2.5 min-w-[180px]"><div class="flex items-center">' + starIcon + '<div class="font-bold text-slate-700 dark:text-slate-200 text-sm truncate">' + c.name + '</div></div><div class="mt-0.5 flex flex-wrap gap-1">' + badgesInfo + '</div>' + errorHtml + '</td>' +
            '<td class="px-4 py-2.5 text-center"><span class="pill ' + pillClass + '">' + st.label + '</span></td>' +
            '<td class="px-4 py-2.5 text-right font-mono text-xs text-slate-400 dark:text-slate-500">' + c.esp_score.toFixed(1) + '</td>' +
            '<td class="px-4 py-2.5 text-right font-mono text-xs text-slate-400 dark:text-slate-500">' + c.disc_score.toFixed(1) + '</td>' +
            '<td class="px-4 py-2.5 text-right font-extrabold font-mono text-sm text-indigo-700 dark:text-indigo-400">' + displayScore + '</td>';

        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
    renderedCount += chunk.length;
    document.getElementById('loadedCount').innerText = Math.min(renderedCount, list.length) + '/' + list.length;
    spinner.classList.add('hidden');
}

// --- GAP ANALYSIS & RADAR ---
function calculateGap(candidate) {
    var mainQuota = candidate.cotas.length > 1 ? candidate.cotas.filter(function (x) { return x !== 'AC' })[0] : 'AC';
    var list = calculatedData.filter(function (c) { return c.cotas.includes(mainQuota) && !excludedIds.includes(c.id); });
    var lastVaga = [].concat(list).reverse().find(function (c) { return c.computedStatus.label.includes('VAGA'); });
    var lastCR = [].concat(list).reverse().find(function (c) { return c.computedStatus.label.includes('CR'); });

    var vagaCutoff = lastVaga ? lastVaga.total_score : 0;
    var crCutoff = lastCR ? lastCR.total_score : 0;

    var gapEl = document.getElementById('gapAnalysis');
    var gapText = document.getElementById('gapText');
    var stLabel = candidate.computedStatus.label;

    if (stLabel.includes('VAGA')) {
        gapEl.classList.remove('hidden');
        gapText.innerText = "Parabéns! Você está classificado dentro das vagas imediatas.";
        gapText.className = "text-xs font-bold text-emerald-600 dark:text-emerald-400";
    } else if (stLabel.includes('CR')) {
        var diff = (vagaCutoff - candidate.total_score).toFixed(2);
        gapEl.classList.remove('hidden');
        gapText.innerText = "Você está no Cadastro Reserva. Aguarde convocações.";
        gapText.className = "text-xs font-bold text-sky-600 dark:text-sky-400";
    } else {
        var diff = (crCutoff - candidate.total_score).toFixed(2);
        gapEl.classList.remove('hidden');
        gapText.innerText = "Faltam " + diff + " pontos para entrar no Cadastro Reserva.";
        gapText.className = "text-xs font-bold text-slate-500 dark:text-slate-400";
    }
}

function calculatePercentile(candidate) {
    var totalCandidates = allData.length;
    var betterThan = allData.filter(function (c) { return c.total_score < candidate.total_score; }).length;
    var percentile = Math.floor((betterThan / totalCandidates) * 100);
    document.getElementById('mPercentil').innerText = 'Melhor que ' + percentile + '%';
}

function renderRadarChart(c) {
    var ctx = document.getElementById('radarChart').getContext('2d');
    if (radarChart) radarChart.destroy();

    // Cores baseadas no tema
    var isDark = document.documentElement.classList.contains('dark');
    var colorGrid = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
    var colorPoint = isDark ? '#fff' : '#4f46e5';

    // Normalização
    var maxEsp = 110;
    var maxDisc = 40;
    var maxGeral = 30; // aprox

    radarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Específica', 'Discursiva', 'Geral'],
            datasets: [{
                label: 'Performance',
                data: [
                    (c.esp_score / maxEsp) * 100,
                    (c.disc_score / maxDisc) * 100,
                    (c.geral_score / maxGeral) * 100
                ],
                fill: true,
                backgroundColor: 'rgba(79, 70, 229, 0.2)',
                borderColor: '#4f46e5',
                pointBackgroundColor: colorPoint,
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#4f46e5',
                pointRadius: 4,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // ESSENCIAL para preencher o modal
            animation: { duration: 400 }, // Animação mais rápida
            scales: {
                r: {
                    angleLines: { color: colorGrid },
                    grid: { color: colorGrid },
                    suggestedMin: 0,
                    suggestedMax: 100,
                    ticks: { display: false, backdropColor: 'transparent' },
                    pointLabels: {
                        font: { size: 10, weight: 'bold' },
                        color: isDark ? '#cbd5e1' : '#64748b'
                    }
                }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// --- MODAL ---
window.openModal = function (c, pos, pillClass) {
    currentModalCandidate = c;

    document.getElementById('mName').innerText = c.name;
    document.getElementById('mPos').innerText = '#' + c.pos_geral;
    document.getElementById('mId').innerText = c.id;
    document.getElementById('mTotal').innerText = c.total_score.toFixed(2);
    document.getElementById('mEsp').innerText = c.esp_score.toFixed(2);
    document.getElementById('mDisc').innerText = c.disc_score.toFixed(2);

    document.getElementById('mStatusBadge').innerHTML = '<span class="pill ' + pillClass + ' text-sm px-4 py-1">' + c.computedStatus.label + '</span>';

    // Update Exclusion Button Text
    var btnExclude = document.getElementById('btnExclude');
    if (excludedIds.includes(c.id)) {
        btnExclude.innerText = "Reativar Candidato";
        btnExclude.classList.add('bg-red-100');
    } else {
        btnExclude.innerText = "Marcar Desistente";
        btnExclude.classList.remove('bg-red-100');
    }

    calculateGap(c);
    calculatePercentile(c);

    // Wait for modal transition to render chart
    setTimeout(function () { renderRadarChart(c); }, 300);

    var cotasContainer = document.getElementById('mCotasInfo');
    cotasContainer.innerHTML = '';

    var hasDetails = false;
    var addDetail = function (label, text, colorClass) {
        if (text && text !== '-') {
            cotasContainer.innerHTML +=
                '<div class="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-[#262626] p-2 rounded border-l-4 ' + colorClass + '">' +
                '<strong class="uppercase text-[10px] opacity-70">' + label + '</strong><br/>' + text +
                '</div>';
            hasDetails = true;
        }
    };

    addDetail('Pessoa Negra', c.res_pn_text, 'border-orange-400');
    addDetail('PCD', c.res_pcd_text, 'border-blue-400');
    addDetail('Indígena', c.res_pi_text, 'border-emerald-400');
    addDetail('Quilombola', c.res_pq_text, 'border-purple-400');

    if (!hasDetails) cotasContainer.innerHTML = '<span class="text-xs text-slate-400 italic block text-center py-2">Nenhuma observação de cota registrada.</span>';

    var modal = document.getElementById('detailModal');
    var content = document.getElementById('modalContent');
    var overlay = document.getElementById('modalOverlay');

    modal.classList.remove('hidden', 'pointer-events-none');
    requestAnimationFrame(function () {
        overlay.style.opacity = '1';
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    });
};

function setupIntersectionObserver() {
    var options = { root: document.getElementById('tableContainer'), rootMargin: '200px', threshold: 0.1 };
    var sentinel = document.getElementById('scrollSentinel');
    if (sentinel) {
        observer = new IntersectionObserver(function (entries) {
            if (entries[0].isIntersecting && renderedCount < currentViewList.length) renderBatch();
        }, options);
        observer.observe(sentinel);
    }
}

document.addEventListener('DOMContentLoaded', function () {
    var tableContainer = document.getElementById('tableContainer');
    if (tableContainer) {
        tableContainer.addEventListener('scroll', function () {
            var scrollGroup = document.getElementById('scrollGroup');
            if (tableContainer.scrollTop > 300) {
                scrollGroup.classList.remove('opacity-0', 'translate-y-10', 'pointer-events-none');
            } else {
                scrollGroup.classList.add('opacity-0', 'translate-y-10', 'pointer-events-none');
            }
        });
    }
});

var fileInput = document.getElementById('fileInput');
if (fileInput) {
    fileInput.addEventListener('change', function (e) {
        var file = e.target.files[0];
        if (!file) return;
        document.getElementById('loadingUpload').classList.remove('hidden');
        var reader = new FileReader();
        reader.onload = function (evt) { processJSON(evt.target.result); };
        reader.readAsText(file);
    });
}

// AUTO-INIT IF DATA EXISTS IN STORAGE
if (localStorage.getItem('cnu_v16_data')) checkDataAvailability();

window.toggleCompactMode = function () {
    document.body.classList.toggle('compact-mode');
    var isCompact = document.body.classList.contains('compact-mode');
    localStorage.setItem('cnu_compact', isCompact);
    alert(isCompact ? "Modo Compacto: ATIVADO" : "Modo Compacto: DESATIVADO");
};

// Carregar preferência ao iniciar
if (localStorage.getItem('cnu_compact') === 'true') {
    document.body.classList.add('compact-mode');
}
window.toggleHelp = function () {
    var modal = document.getElementById('helpModal');
    var overlay = document.getElementById('helpOverlay');
    var content = document.getElementById('helpContent');

    if (modal.classList.contains('hidden')) {
        modal.classList.remove('hidden', 'pointer-events-none');
        requestAnimationFrame(function () {
            overlay.style.opacity = '1';
            content.classList.remove('scale-95', 'opacity-0');
        });
    } else {
        overlay.style.opacity = '0';
        content.classList.add('scale-95', 'opacity-0');
        setTimeout(function () { modal.classList.add('hidden', 'pointer-events-none'); }, 300);
    }
};

// Auto-abrir ajuda na primeira visita
if (!localStorage.getItem('cnu_help_seen')) {
    setTimeout(toggleHelp, 1500); // Abre após 1.5s
    localStorage.setItem('cnu_help_seen', 'true');
}

var myIdentityId = localStorage.getItem('cnu_my_id');

window.setMyIdentity = function () {
    if (!currentModalCandidate) return;
    myIdentityId = currentModalCandidate.id;
    localStorage.setItem('cnu_my_id', myIdentityId);

    // Ativa o dashboard pessoal
    updateHeroDashboard();

    alert("Olá, " + currentModalCandidate.name.split(' ')[0] + "! Seu painel foi personalizado.");
    window.closeModal();

    // Opcional: Rolar para o topo para ver o painel
    document.getElementById('tableContainer').scrollTo({ top: 0, behavior: 'smooth' });
};

window.clearIdentity = function () {
    if (confirm("Deseja remover sua identificação deste dispositivo?")) {
        localStorage.removeItem('cnu_my_id');
        myIdentityId = null;
        document.getElementById('myHeroDashboard').classList.add('hidden');
    }
};

function updateHeroDashboard() {
    if (!myIdentityId) return;

    // Busca dados atualizados (considerando filtros/simulações)
    var me = calculatedData.find(function (c) { return c.id === myIdentityId; });

    if (me) {
        var hero = document.getElementById('myHeroDashboard');
        hero.classList.remove('hidden');
        hero.classList.add('flex'); // Garante display flex

        document.getElementById('heroName').innerText = me.name;
        document.getElementById('heroPos').innerText = '#' + me.pos_geral;
        document.getElementById('heroScore').innerText = me.total_score.toFixed(2);
        document.getElementById('heroStatus').innerText = me.computedStatus.label;

        // Cálculo simples de gap
        var score = me.total_score;
        var cutoff = parseFloat(document.getElementById('kpiMax').innerText) || 0;
        // Nota: Lógica de cutoff precisa pegar o último da vaga. 
        // Simplificação: Se for VAGA, mostra "Classificado", se não, mostra diferença pro corte.
        if (me.computedStatus.label.includes('VAGA')) {
            document.getElementById('heroGap').innerText = "DENTRO";
            document.getElementById('heroGap').className = "text-sm font-bold text-emerald-300";
        } else {
            // Tenta achar nota de corte da Vaga AC ou da Cota dele
            // ... (lógica simplificada para exemplo) ...
            document.getElementById('heroGap').innerText = "CR";
        }
    }
}
window.editCandidateScore = function () {
    if (!currentModalCandidate) return;
    openEditModal(currentModalCandidate);
};

// --- MODAL FUNCTIONS ---
window.openEditModal = function (c) {
    var modal = document.getElementById('editScoreModal');
    var overlay = document.getElementById('editScoreOverlay');
    var content = document.getElementById('editScoreContent');

    document.getElementById('input_geral').value = c.geral_score;
    document.getElementById('input_esp').value = c.esp_score;
    document.getElementById('input_disc').value = c.disc_score;
    document.getElementById('input_tit').value = c.titulos_score;

    modal.classList.remove('hidden', 'pointer-events-none');
    requestAnimationFrame(function () {
        overlay.style.opacity = '1';
        content.classList.remove('scale-95', 'opacity-0');
    });
};

window.closeEditModal = function () {
    var modal = document.getElementById('editScoreModal');
    var overlay = document.getElementById('editScoreOverlay');
    var content = document.getElementById('editScoreContent');

    overlay.style.opacity = '0';
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(function () {
        modal.classList.add('hidden', 'pointer-events-none');
    }, 300);
};

window.confirmSimulation = function () {
    if (!currentModalCandidate) return;
    var c = currentModalCandidate;

    var newGeral = parseFloat(document.getElementById('input_geral').value) || 0;
    var newEsp = parseFloat(document.getElementById('input_esp').value) || 0;
    var newDisc = parseFloat(document.getElementById('input_disc').value) || 0;
    var newTit = parseFloat(document.getElementById('input_tit').value) || 0;

    var oldTotal = c.total_score;

    // FIND ORIGINAL IN ALLDATA
    var original = allData.find(function (x) { return x.id === c.id; });
    if (original) {
        original.geral_score = newGeral;
        original.esp_score = newEsp;
        original.disc_score = newDisc;
        original.titulos_score = newTit;
        original.obj_score = original.geral_score + original.esp_score;
        original.total_score = original.obj_score + original.disc_score + original.titulos_score;
        original.is_simulated = true;
    }

    // Update the view copy as well so Toast shows correct values immediately (though re-render will fix it)
    c.geral_score = newGeral;
    c.esp_score = newEsp;
    c.disc_score = newDisc;
    c.titulos_score = newTit;
    c.obj_score = c.geral_score + c.esp_score;
    c.total_score = c.obj_score + c.disc_score + c.titulos_score;
    c.is_simulated = true;

    // Resort
    allData.sort(function (a, b) {
        if (Math.abs(b.total_score - a.total_score) > 0.001) return b.total_score - a.total_score;
        if (Math.abs(b.esp_score - a.esp_score) > 0.001) return b.esp_score - a.esp_score;
        if (Math.abs(b.disc_score - a.disc_score) > 0.001) return b.disc_score - a.disc_score;
        return b.geral_score - a.geral_score;
    });

    processCascading();

    var diff = c.total_score - oldTotal;
    var msgDiff = diff > 0 ? "+" + diff.toFixed(2) : diff.toFixed(2);

    // Close Modal
    closeEditModal();
    window.closeModal(); // Close details modal too if open
    updateView();

    // Show Toast
    showToast("Simulação Aplicada! Nova Nota: " + c.total_score.toFixed(2) + " (" + msgDiff + ")", "success");

    // Highlight
    setTimeout(function () {
        var row = document.getElementById('tr-' + c.id);
        if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            row.classList.add('bg-amber-100', 'dark:bg-amber-900/30');
            setTimeout(function () { row.classList.remove('bg-amber-100', 'dark:bg-amber-900/30'); }, 3000);
        }
    }, 500);
};

// --- TOAST NOTIFICATIONS ---
window.showToast = function (message, type) {
    var container = document.getElementById('toastContainer');
    var toast = document.createElement('div');

    var bgClass = type === 'success' ? 'bg-emerald-500' : 'bg-slate-800';
    var icon = type === 'success' ? '<i class="fa-solid fa-check-circle"></i>' : '<i class="fa-solid fa-info-circle"></i>';

    toast.className = "flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-white text-sm font-bold transform translate-x-full transition-all duration-300 " + bgClass;
    toast.innerHTML = icon + "<span>" + message + "</span>";

    container.appendChild(toast);

    // Animate In
    requestAnimationFrame(function () {
        toast.classList.remove('translate-x-full');
    });

    // Animate Out & Remove
    setTimeout(function () {
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(function () {
            toast.remove();
        }, 300);
    }, 4000);
};

// --- INICIALIZAÇÃO SEGURA ---
checkDataAvailability();

// --- STATISTICS DASHBOARD ---
window.openStatsModal = function () {
    var modal = document.getElementById('statsModal');
    var overlay = document.getElementById('statsOverlay');
    var content = document.getElementById('statsContent');

    if (!modal) return; // Safety check

    modal.classList.remove('hidden', 'pointer-events-none');
    requestAnimationFrame(function () {
        overlay.style.opacity = '1';
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    });

    renderStatistics();
};

window.closeStatsModal = function () {
    var modal = document.getElementById('statsModal');
    var overlay = document.getElementById('statsOverlay');
    var content = document.getElementById('statsContent');

    if (!modal) return;

    overlay.style.opacity = '0';
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');

    setTimeout(function () {
        modal.classList.add('hidden', 'pointer-events-none');
    }, 300);
};

var statPieChartInstance = null;
var statBarChartInstance = null;

function renderStatistics() {
    if (!window.calculatedData) return;

    var totalCandidates = calculatedData.length;
    var scores = calculatedData.map(c => c.total_score);
    var avgScore = (scores.reduce((a, b) => a + b, 0) / totalCandidates).toFixed(2);

    // Filter relevant statuses for Charts
    var vagas = calculatedData.filter(c => c.computedStatus.label.includes('VAGA'));
    var crs = calculatedData.filter(c => c.computedStatus.label.includes('CR'));
    var elims = calculatedData.filter(c => c.computedStatus.label === 'ELIMINADO');

    // Calculate Cutoffs (Using AC specifically)
    var vagasAC = calculatedData.filter(c => c.computedStatus.label === 'VAGA AC');
    var crAC = calculatedData.filter(c => c.computedStatus.label === 'CR AC');

    // Sort descending to be safe
    vagasAC.sort((a, b) => b.total_score - a.total_score);
    crAC.sort((a, b) => b.total_score - a.total_score);

    var cutVaga = vagasAC.length > 0 ? vagasAC[vagasAC.length - 1].total_score.toFixed(2) : '-';
    var cutCR = crAC.length > 0 ? crAC[crAC.length - 1].total_score.toFixed(2) : '-';

    // Update KPIS
    document.getElementById('statTotal').innerText = totalCandidates.toLocaleString('pt-BR');
    document.getElementById('statAvg').innerText = avgScore;
    document.getElementById('statCutVaga').innerText = cutVaga;
    document.getElementById('statCutCR').innerText = cutCR;

    // --- CHARTS ---
    var isDark = document.documentElement.classList.contains('dark');
    var textColor = isDark ? '#cbd5e1' : '#64748b';

    // 1. PIE CHART
    var ctxPie = document.getElementById('statPieChart').getContext('2d');
    if (statPieChartInstance) statPieChartInstance.destroy();

    statPieChartInstance = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: ['Vagas', 'Cadastro Reserva', 'Eliminados/Outros'],
            datasets: [{
                data: [vagas.length, crs.length, totalCandidates - vagas.length - crs.length],
                backgroundColor: ['#10b981', '#0ea5e9', isDark ? '#334155' : '#cbd5e1'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { color: textColor } }
            }
        }
    });

    // 2. BAR CHART
    var quotas = ['AC', 'PN', 'PCD'];
    var datasetEsp = [];
    var datasetDisc = [];

    quotas.forEach(q => {
        var group = calculatedData.filter(c => c.cotas.includes(q));
        if (group.length === 0) { datasetEsp.push(0); datasetDisc.push(0); return; }

        var avgEsp = group.reduce((sum, c) => sum + c.esp_score, 0) / group.length;
        var avgDisc = group.reduce((sum, c) => sum + c.disc_score, 0) / group.length;

        datasetEsp.push(avgEsp);
        datasetDisc.push(avgDisc);
    });

    var ctxBar = document.getElementById('statBarChart').getContext('2d');
    if (statBarChartInstance) statBarChartInstance.destroy();

    statBarChartInstance = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: quotas,
            datasets: [
                {
                    label: 'Média Específica',
                    data: datasetEsp,
                    backgroundColor: '#6366f1',
                    borderRadius: 4
                },
                {
                    label: 'Média Discursiva',
                    data: datasetDisc,
                    backgroundColor: '#8b5cf6',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: textColor } }
            },
            scales: {
                y: { ticks: { color: textColor }, grid: { color: isDark ? '#333' : '#e2e8f0' } },
                x: { ticks: { color: textColor }, grid: { display: false } }
            }
        }
    });

    // --- TABLES ---
    var top5 = calculatedData.slice(0, 5);
    var topBody = document.getElementById('statTopBody');
    if (topBody) {
        topBody.innerHTML = '';
        top5.forEach(c => {
            topBody.innerHTML += `
                <tr class="border-b border-slate-50 dark:border-slate-800">
                    <td class="p-3 font-mono text-slate-500">#${c.pos_geral}</td>
                    <td class="p-3 font-bold text-slate-700 dark:text-slate-300 truncate max-w-[150px]">${c.name}</td>
                    <td class="p-3 text-right font-bold text-indigo-600 dark:text-indigo-400">${c.total_score.toFixed(2)}</td>
                </tr>
            `;
        });
    }

    var cotasBody = document.getElementById('statCotasBody');
    if (cotasBody) {
        cotasBody.innerHTML = '';
        var quotaCounts = { 'AC': 0, 'PN': 0, 'PCD': 0, 'PI': 0, 'PQ': 0 };
        calculatedData.forEach(c => {
            c.cotas.forEach(q => { if (quotaCounts[q] !== undefined) quotaCounts[q]++; });
        });

        Object.keys(quotaCounts).forEach(q => {
            var count = quotaCounts[q];
            var pct = totalCandidates > 0 ? ((count / totalCandidates) * 100).toFixed(1) + '%' : '0%';
            cotasBody.innerHTML += `
                <tr class="border-b border-slate-50 dark:border-slate-800">
                     <td class="p-3 font-bold text-slate-500">${q}</td>
                     <td class="p-3 text-right text-slate-700 dark:text-slate-300">${count}</td>
                     <td class="p-3 text-right font-mono text-xs text-slate-400">${pct}</td>
                </tr>
            `;
        });
    }
}

// --- EXPORTS ---
window.generatePDF = function () {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Minimalist Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Relatório de Classificação - CNU Bloco 7", 14, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Gerado em: " + new Date().toLocaleString(), 14, 26);

    var search = document.getElementById('searchInput').value.toLowerCase();

    var filterName = document.getElementById('viewFilter').value;

    // Apply Filters (Same logic as renderBatch)
    var filteredData = (window.currentRenderData || calculatedData).filter(function (c) {
        var matchSearch = !search || c.name.toLowerCase().includes(search) || c.id.includes(search);
        if (!matchSearch) return false;
        if (quickFilter === 'ALL') return true;
        if (quickFilter === 'VAGA') return c.computedStatus.label.includes('VAGA');
        if (quickFilter === 'CR') return c.computedStatus.label.includes('CR');
        return false;
    });

    var data = filteredData.map((c, i) => [
        (i + 1) + "º (Geral #" + c.pos_geral + ")",
        c.name,
        c.computedStatus.label,
        c.esp_score.toFixed(2),
        c.disc_score.toFixed(2),
        c.total_score.toFixed(2)
    ]);

    const headers = [["Posição", "Nome", "Status", "Esp", "Disc", "Total"]];

    doc.autoTable({
        head: headers,
        body: data,
        startY: 35,
        theme: 'plain', // Minimalist theme
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fontStyle: 'bold', fillColor: [240, 240, 240], textColor: 50 }, // Light gray header
        alternateRowStyles: { fillColor: [249, 250, 251] }
    });

    var filename = "classificacao_cnu_" + filterName + ".pdf";
    doc.save(filename);
};

window.exportExcel = function () {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Posição Relativa;Posição Geral;Nome;Status;Nota Objetiva;Nota Discursiva;Nota Títulos;Nota Final\n";

    var search = document.getElementById('searchInput').value.toLowerCase();
    var filterName = document.getElementById('viewFilter').value;

    var dataToExport = (window.currentRenderData || calculatedData).filter(function (c) {
        var matchSearch = !search || c.name.toLowerCase().includes(search) || c.id.includes(search);
        if (!matchSearch) return false;
        if (quickFilter === 'ALL') return true;
        if (quickFilter === 'VAGA') return c.computedStatus.label.includes('VAGA');
        if (quickFilter === 'CR') return c.computedStatus.label.includes('CR');
        return false;
    });

    dataToExport.forEach(function (c, i) {
        let row = [
            (i + 1) + "º",
            "#" + c.pos_geral,
            c.name,
            c.computedStatus.label,
            c.obj_score.toFixed(2).replace('.', ','),
            c.disc_score.toFixed(2).replace('.', ','),
            c.titulos_score.toFixed(2).replace('.', ','),
            c.total_score.toFixed(2).replace('.', ',')
        ];
        csvContent += row.join(";") + "\n";
    });

    var encodedUri = encodeURI(csvContent);
    var link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    var filename = "classificacao_cnu_" + filterName + ".csv";
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};