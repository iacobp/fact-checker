(function() {
  if (window.perplexityFactCheckerInjected) {
    return;
  }
  window.perplexityFactCheckerInjected = true;

  let factCheckBox = null;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message in content script:', request);
    switch (request.action) {
      case "checkInjection":
        sendResponse({ injected: true });
        break;
      case "showLoading":
        showLoading();
        break;
      case "factCheckResult":
        showFactCheckResult(request.data);
        break;
      case "factCheckError":
        showError(request.error);
        break;
    }
  });

  function showLoading() {
    if (!factCheckBox) {
      factCheckBox = createFactCheckBox();
    }
    factCheckBox.innerHTML = `
      <div class="fact-check-header">
        <h2>Fact Checker</h2>
        <button id="close-fact-check">×</button>
      </div>
      <p>Loading... This may take a few moments.</p>
      <div class="loader"></div>
    `;
    factCheckBox.style.display = 'block';
    addCloseButtonListener();
  }

  function showFactCheckResult(result) {
    console.log('Showing fact check result:', result);
    if (!factCheckBox) {
      factCheckBox = createFactCheckBox();
    }
    const parsedResult = parseFactCheckResult(result);
    updateFactCheckBox(parsedResult);
  }

  function createFactCheckBox() {
    const box = document.createElement('div');
    box.id = 'perplexity-fact-check-box';
    document.body.appendChild(box);
    makeDraggableAndResizable(box);
    return box;
  }

  function updateFactCheckBox(result) {
    console.log('Updating fact check box with:', result);
    const truthColor = getTruthColor(result.truthPercentage);
    console.log('Truth color:', truthColor);
    factCheckBox.innerHTML = `
      <div class="fact-check-header">
        <h2>Fact Checker</h2>
        <button id="close-fact-check">×</button>
      </div>
      <h3 id="truth-percentage">Truth Percentage: <span style="color: ${truthColor} !important;">${result.truthPercentage}</span></h3>
      <h4>Fact Check:</h4>
      <p>${result.factCheck}</p>
      <h4>Context:</h4>
      <p>${result.context}</p>
      <h4>Sources:</h4>
      <ol>
        ${result.sources.map(source => `<li value="${source.index}"><a href="${source.url}" target="_blank">${source.title}</a></li>`).join('')}
      </ol>
      <button id="copy-result">Copy Result</button>
    `;
    factCheckBox.style.display = 'block';
    addCloseButtonListener();
    addCopyButtonListener(result);
  }

  function parseFactCheckResult(result) {
    console.log("Parsing raw result:", result);

    const sections = result.split('\n\n');
    const parsedResult = {
      truthPercentage: 'N/A',
      factCheck: 'No fact check provided.',
      context: 'No context provided.',
      sources: []
    };

    let currentSection = '';

    sections.forEach(section => {
      if (section.startsWith('Sources:')) {
        currentSection = 'sources';
        const sourceLines = section.split('\n').slice(1);
        console.log("Source lines:", sourceLines);
        sourceLines.forEach(line => {
          const match = line.match(/(\d+)\.\s+(.+)/);
          if (match) {
            const [, index, content] = match;
            const urlMatch = content.match(/\[(.+?)\]\((.+?)\)/);
            if (urlMatch) {
              parsedResult.sources.push({ index, title: urlMatch[1], url: urlMatch[2] });
            } else {
              parsedResult.sources.push({ index, title: content, url: '#' });
            }
          }
        });
      } else if (section.startsWith('Truth:')) {
        currentSection = 'truth';
        parsedResult.truthPercentage = section.split(':')[1].trim();
      } else if (section.startsWith('Fact Check:')) {
        currentSection = 'factCheck';
        parsedResult.factCheck = section.split(':').slice(1).join(':').trim();
      } else if (section.startsWith('Context:')) {
        currentSection = 'context';
        parsedResult.context = section.split(':').slice(1).join(':').trim();
      } else if (currentSection === 'factCheck') {
        parsedResult.factCheck += ' ' + section.trim();
      } else if (currentSection === 'context') {
        parsedResult.context += ' ' + section.trim();
      }
    });

    console.log("Parsed result:", parsedResult);

    // Replace source references with hyperlinks
    parsedResult.factCheck = replaceSourceReferences(parsedResult.factCheck, parsedResult.sources);
    parsedResult.context = replaceSourceReferences(parsedResult.context, parsedResult.sources);

    return parsedResult;
  }

  function replaceSourceReferences(text, sources) {
    return text.replace(/\[(\d+(?:,\s*\d+)*)\]/g, (match, p1) => {
      const indices = p1.split(',').map(s => s.trim());
      const links = indices.map(index => {
        const source = sources.find(s => s.index === index);
        if (source) {
          return `<a href="${source.url}" target="_blank">[${index}]</a>`;
        }
        return `[${index}]`;
      });
      return links.join(', ');
    });
  }

  function getTruthColor(percentage) {
    console.log('Received percentage:', percentage);
    const value = parseInt(percentage);
    console.log('Parsed value:', value);
    if (isNaN(value)) {
      console.log('Returning black due to NaN');
      return 'black';
    }
    if (value >= 80) return 'green';
    if (value >= 60) return 'goldenrod';
    if (value >= 40) return 'orange';
    return 'red';
  }

  function showError(message) {
    console.error('Showing error:', message);
    if (!factCheckBox) {
      factCheckBox = createFactCheckBox();
    }
    factCheckBox.innerHTML = `
      <div class="fact-check-header">
        <h2>Error</h2>
        <button id="close-fact-check">×</button>
      </div>
      <p>${message}</p>
    `;
    factCheckBox.style.display = 'block';
    addCloseButtonListener();
  }

  function addCloseButtonListener() {
    setTimeout(() => {
      const closeButton = document.getElementById('close-fact-check');
      if (closeButton) {
        console.log('Close button found, adding event listener');
        closeButton.addEventListener('click', () => {
          console.log('Close button clicked');
          if (factCheckBox) {
            factCheckBox.style.display = 'none';
          }
        });
      } else {
        console.log('Close button not found');
      }
    }, 100);  // 100ms delay
  }

  function addCopyButtonListener(result) {
    const copyButton = document.getElementById('copy-result');
    if (copyButton) {
      copyButton.addEventListener('click', () => {
        const textToCopy = `
Truth Percentage: ${result.truthPercentage}

Fact Check: ${result.factCheck}

Context: ${result.context}

Sources:
${result.sources.map(source => `${source.index}. ${source.title} - ${source.url}`).join('\n')}
        `;
        navigator.clipboard.writeText(textToCopy).then(() => {
          copyButton.textContent = 'Copied!';
          setTimeout(() => {
            copyButton.textContent = 'Copy Result';
          }, 2000);
        });
      });
    }
  }

  function isDarkMode() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function makeDraggableAndResizable(element) {
    let isResizing = false;
    let isDragging = false;
    let startX, startY, startWidth, startHeight, startLeft, startTop;
    let resizeDirection = '';

    element.addEventListener('mousedown', startDragOrResize);
    document.addEventListener('mousemove', dragOrResize);
    document.addEventListener('mouseup', stopDragOrResize);
    element.addEventListener('mousemove', updateCursor);

    function startDragOrResize(e) {
      if (isNearEdge(e, element)) {
        isResizing = true;
        resizeDirection = getResizeDirection(e, element);
      } else {
        isDragging = true;
      }
      startX = e.clientX;
      startY = e.clientY;
      startWidth = element.offsetWidth;
      startHeight = element.offsetHeight;
      startLeft = element.offsetLeft;
      startTop = element.offsetTop;
      e.preventDefault();
    }

    function dragOrResize(e) {
      if (isResizing) {
        resize(e);
      } else if (isDragging) {
        drag(e);
      }
    }

    function resize(e) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (resizeDirection.includes('w')) {
        element.style.width = `${Math.max(200, startWidth - dx)}px`;
        element.style.left = `${startLeft + dx}px`;
      } else if (resizeDirection.includes('e')) {
        element.style.width = `${Math.max(200, startWidth + dx)}px`;
      }

      if (resizeDirection.includes('n')) {
        element.style.height = `${Math.max(200, startHeight - dy)}px`;
        element.style.top = `${startTop + dy}px`;
      } else if (resizeDirection.includes('s')) {
        element.style.height = `${Math.max(200, startHeight + dy)}px`;
      }
    }

    function drag(e) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      element.style.left = `${startLeft + dx}px`;
      element.style.top = `${startTop + dy}px`;
    }

    function stopDragOrResize() {
      isResizing = false;
      isDragging = false;
      resizeDirection = '';
      element.style.cursor = 'default';
    }

    function updateCursor(e) {
      const direction = getResizeDirection(e, element);
      if (direction) {
        element.style.cursor = getCursorStyle(direction);
      } else {
        element.style.cursor = 'move';
      }
    }

    function isNearEdge(e, element) {
      const rect = element.getBoundingClientRect();
      const edgeThreshold = 10;
      return (
        e.clientX < rect.left + edgeThreshold ||
        e.clientX > rect.right - edgeThreshold ||
        e.clientY < rect.top + edgeThreshold ||
        e.clientY > rect.bottom - edgeThreshold
      );
    }

    function getResizeDirection(e, element) {
      const rect = element.getBoundingClientRect();
      const edgeThreshold = 10;
      let direction = '';

      if (e.clientY < rect.top + edgeThreshold) direction += 'n';
      else if (e.clientY > rect.bottom - edgeThreshold) direction += 's';

      if (e.clientX < rect.left + edgeThreshold) direction += 'w';
      else if (e.clientX > rect.right - edgeThreshold) direction += 'e';

      return direction;
    }

    function getCursorStyle(direction) {
      switch (direction) {
        case 'n':
        case 's':
          return 'ns-resize';
        case 'e':
        case 'w':
          return 'ew-resize';
        case 'nw':
        case 'se':
          return 'nwse-resize';
        case 'ne':
        case 'sw':
          return 'nesw-resize';
        default:
          return 'move';
      }
    }
  }

  const style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Satoshi:wght@400;700&display=swap');

    #perplexity-fact-check-box {
      position: fixed;
      top: 20px;
      right: 20px;
      width: 300px;
      height: 400px;
      min-width: 200px;
      min-height: 200px;
      max-width: 80vw;
      max-height: 80vh;
      overflow-y: auto;
      background-color: ${isDarkMode() ? '#333' : 'white'};
      color: ${isDarkMode() ? 'white' : 'black'} !important;
      border: 1px solid #ccc;
      border-radius: 10px;
      padding: 15px;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
      z-index: 9999;
      font-family: 'Satoshi', sans-serif !important;
    }
    #perplexity-fact-check-box * {
      font-family: 'Satoshi', sans-serif !important;
      color: ${isDarkMode() ? 'white' : 'black'} !important;
    }
    #perplexity-fact-check-box .fact-check-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    #perplexity-fact-check-box h2 {
      margin: 0;
      text-align: center;
      width: 100%;
      font-size: 24px;
    }
    #perplexity-fact-check-box h3 {
      text-align: center;
      font-size: 20px;
      margin-top: 0;
      margin-bottom: 25px;
    }
    #perplexity-fact-check-box h4 {
      margin-top: 20px;
      margin-bottom: 10px;
      font-size: 18px;
    }
    #perplexity-fact-check-box p, #perplexity-fact-check-box li {
      font-size: 14px;
      line-height: 1.4;
    }
    #perplexity-fact-check-box a {
      color: ${isDarkMode() ? '#add8e6' : '#0000EE'} !important;
      text-decoration: none;
    }
    #perplexity-fact-check-box a:hover {
      text-decoration: underline;
    }
    #close-fact-check {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: ${isDarkMode() ? 'white' : 'black'} !important;
      position: absolute;
      top: 10px;
      right: 10px;
    }
    #copy-result {
      display: block;
      margin-top: 15px;
      padding: 5px 10px;
      background-color: #4CAF50;
      color: white !important;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 14px;
    }
    #copy-result:hover {
      background-color: #45a049;
    }
    .loader {
      border: 5px solid #f3f3f3;
      border-top: 5px solid #3498db;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      animation: spin 1s linear infinite;
      margin: 20px auto;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
})();