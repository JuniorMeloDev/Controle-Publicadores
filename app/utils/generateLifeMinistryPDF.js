import jsPDF from 'jspdf';

export const generateLifeMinistryPDF = (schedule, assignments, weekText, existingDoc = null, saveInfo = true) => {
    const doc = existingDoc || new jsPDF('p', 'mm', 'a4');
    
    if (existingDoc) {
        doc.addPage();
    }
    
    if (!schedule || !assignments) return null;

    // --- CONFIGURAÇÕES GERAIS ---
    const margin = 5;
    const pageWidth = 210;
    const contentWidth = pageWidth - (margin * 2);
    let currentY = margin;

    // Cores
    const colors = {
      blue: [23, 58, 110],
      orange: [160, 80, 0],   
      red: [150, 0, 0],
      black: [0, 0, 0],
      gray: [100, 100, 100],
      cyan: [0, 150, 150]
    };

    const headerBgFn = () => doc.setFillColor(240, 240, 240);
    const timeBgFn = () => doc.setFillColor(230, 230, 230);
    const sectionBgFn = (c) => () => doc.setFillColor(...c); 
    const highlightBgFn = () => doc.setFillColor(230, 230, 230); 

    // --- HELPERS DE TEXTO RICO ---
    const parseRichText = (text, type) => {
      const parts = [];
      if (!text) return parts;
      
      // 1. Normalize "MIN" / "Min"
      let normalized = text.replace(/(\d+)\s*MIN/g, '$1 min').replace(/(\d+)\s*Min/g, '$1 min');

      // Helper: Truncate only for Living section
      const truncate = (t) => {
          if (t.toLowerCase().includes('cântico')) return t;
          const m = t.match(/^(.*?)(\(\d+\s*min\))/i);
          if (m) {
             const base = m[1] + m[2];
             const after = t.substring(m.index + m[0].length);
             let suf = "";
             if (after.match(/^[:\s]*Consideração/i)) suf = ": Consideração";
             return base + suf;
          }
          return t;
      };

      if (type === 'treasures') {
        const match = normalized.match(/^(.*?)(\(\d+\s*min\))(.*)$/i);
        if (match) {
          // Título (com ou sem numero)
          let title = match[1];
          const numMatch = title.match(/^(\d+\.)\s*(.*)$/);
          if (numMatch) {
            parts.push({ text: numMatch[1] + " ", color: colors.blue, font: "bold" });
            parts.push({ text: numMatch[2], color: colors.blue, font: "bold" });
          } else {
            parts.push({ text: title, color: colors.blue, font: "bold" });
          }
          // Tempo
          parts.push({ text: " " + match[2], color: colors.black, font: "bold" }); 
          // Resto
          if (match[3]) parts.push({ text: match[3], color: colors.black, font: "bold" });
        } else {
          parts.push({ text: normalized, color: colors.blue, font: "bold" });
        }

      } else if (type === 'ministry') {
        const match = normalized.match(/^(.*?)(\(\d+\s*min\))(:?)\s*(.*)$/i);
        if (match) {
          parts.push({ text: match[1].toUpperCase(), color: colors.orange, font: "bold" }); // Título
          parts.push({ text: " " + match[2] + match[3], color: colors.black, font: "bold" }); // Tempo

          // Source parsing
          const source = match[4];
          if (source) {
              const sourceParts = source.split(/(\([^)]+\))/g);
              sourceParts.forEach(sp => {
                if (sp.startsWith('(') && sp.endsWith(')')) {
                  if (sp.includes('min')) parts.push({ text: " " + sp, color: colors.black, font: "bold" });
                  else parts.push({ text: " " + sp, color: colors.cyan, font: "normal" });
                } else if (sp.trim()) {
                  parts.push({ text: " " + sp, color: colors.black, font: "bold" });
                }
              });
          }
        } else {
          parts.push({ text: normalized.toUpperCase(), color: colors.orange, font: "bold" });
        }

      } else if (type === 'living') {
        if (normalized.toLowerCase().includes('cântico')) {
          parts.push({ text: normalized, color: colors.blue, font: "bold" });
          return parts;
        }
        
        // Apply Truncation ONLY here
        const truncatedText = truncate(normalized);
        const match = truncatedText.match(/^(.*?)(\(\d+\s*min\))(.*)$/i);
        
        if (match) {
           parts.push({ text: match[1], color: colors.red, font: "bold" });
           parts.push({ text: " " + match[2], color: colors.black, font: "bold" });
           if (match[3]) parts.push({ text: match[3], color: colors.black, font: "bold" });
        } else {
           parts.push({ text: truncatedText, color: colors.red, font: "bold" });
        }
      } else {
        // Default / Normal
        parts.push({ text: normalized, color: colors.black, font: "normal" });
      }
      return parts;
    };

    const measureAndRender = (richParts, x, y, maxWidth, lineHeight = 5, dryRun = false) => {
      doc.setFontSize(10); 
      let cursorX = 0;
      let cursorY = 0; 
      let maxLineWidth = 0;
      let lines = [];
      let currentLine = [];
      let currentLineWidth = 0;

      const words = [];
      richParts.forEach(part => {
        doc.setFont("helvetica", part.font || "normal");
        const partWords = part.text.split(/(\s+)/);
        const { text: fullText, ...style } = part; 

        partWords.forEach(w => {
          if (!w) return;
          const wWidth = doc.getTextWidth(w);
          words.push({ text: w, width: wWidth, ...style });
        });
      });

      words.forEach(word => {
        if (currentLineWidth + word.width > maxWidth && currentLineWidth > 0 && word.text.trim()) {
          lines.push(currentLine);
          currentLine = [];
          currentLineWidth = 0;
          if (!word.text.trim()) return;
        }
        currentLine.push(word);
        currentLineWidth += word.width;
        if (currentLineWidth > maxLineWidth) maxLineWidth = currentLineWidth;
      });
      if (currentLine.length > 0) lines.push(currentLine);

      if (!dryRun) {
        lines.forEach((line, i) => {
          let lineX = x;
          const lineY = y + (i * lineHeight) + (lineHeight * 0.7); // Baseline approx
          line.forEach(word => {
            doc.setTextColor(...(word.color || colors.black));
            doc.setFont("helvetica", word.font || "normal");
            doc.text(word.text, lineX, lineY);
            lineX += word.width;
          });
        });
      }

      return lines.length * lineHeight;
    };

    // --- HELPERS (Copied from LifeMinistryTab) ---
    const getName = (val) => {
        if(val && typeof val === 'object' && val.name) return val.name; 
        return val || "";
    };

    const drawRect = (x, y, w, h, fillFn = null, strokeColor = [0,0,0]) => {
      if (fillFn) { fillFn(); doc.rect(x, y, w, h, 'F'); }
      doc.setDrawColor(...strokeColor); doc.setLineWidth(0.3);
      doc.rect(x, y, w, h, 'S');
    };

    const drawTextCentered = (text, x, y, w, h, fontSize = 11, fontStyle = 'normal', color = colors.black) => {
      doc.setFontSize(fontSize); doc.setFont("helvetica", fontStyle); doc.setTextColor(...color);
      const textW = doc.getTextWidth(text);
      if (textW > w - 2) {
        const lines = doc.splitTextToSize(text, w - 2);
        const blockH = lines.length * 5;
        const startY = y + (h - blockH) / 2 + 3.5;
        doc.text(lines, x + w / 2, startY, { align: 'center' });
      } else {
        doc.text(text, x + w / 2, y + h / 2 + 1.5, { align: 'center', baseline: 'middle' });
      }
    };

    // --- 1. HEADER (Exact Copy) ---
    const headerH = 40; 
    const colNameW = 75; 
    const infoW = colNameW; 
    const infoX = margin + contentWidth - infoW; 
    const titleBoxW = contentWidth - infoW;

    drawRect(margin, currentY, titleBoxW, headerH, headerBgFn);

    doc.setFontSize(15); doc.setTextColor(...colors.blue); doc.setFont("helvetica", "bold");
    doc.text(weekText || "", margin + (titleBoxW / 2), currentY + 14, { align: "center" });

    doc.setFontSize(19); doc.setTextColor(...colors.black);
    doc.text("NOSSA VIDA E MINISTÉRIO CRISTÃO", margin + (titleBoxW / 2), currentY + 28, { align: "center" });

    const infoTitleH = 10;
    const infoRowH = (headerH - infoTitleH) / 2;

    drawRect(infoX, currentY, infoW, infoTitleH, headerBgFn);
    drawTextCentered("Salão Principal", infoX, currentY, infoW, infoTitleH, 11, "bold");

    drawRect(infoX, currentY + infoTitleH, infoW, infoRowH); 
    doc.setFontSize(10); doc.setTextColor(...colors.black); doc.text("Presidente:", infoX + 2, currentY + infoTitleH + infoRowH / 2 + 1.5);
    drawTextCentered(getName(assignments.presidente), infoX + 22, currentY + infoTitleH, infoW - 22, infoRowH, 12, "normal");

    drawRect(infoX, currentY + infoTitleH + infoRowH, infoW, infoRowH); 
    doc.setFontSize(10); doc.setTextColor(...colors.black); doc.text("Ajudante:", infoX + 2, currentY + infoTitleH + infoRowH + infoRowH / 2 + 1.5);
    drawTextCentered(getName(assignments.ajudante), infoX + 22, currentY + infoTitleH + infoRowH, infoW - 22, infoRowH, 12, "normal");

    currentY += headerH;

    // --- TABELA ---
    const colTimeW = 16;
    const colPartW = contentWidth - colTimeW - colNameW;
    const minH = 12; // Increased spacing as requested

    const drawRow = (timeStr, richParts, nameVal, type = 'normal', secondaryLabel = null) => {
      // Handle "Oração --->" special alignment
      let oracaoLabel = "";
      let finalRichParts = richParts;
      if (Array.isArray(richParts)) {
        finalRichParts = JSON.parse(JSON.stringify(richParts));
        const oraIdx = finalRichParts.findIndex(p => p.text.includes("Oração --->"));
        if (oraIdx !== -1) {
          oracaoLabel = "Oração --->";
          finalRichParts[oraIdx].text = finalRichParts[oraIdx].text.replace("Oração --->", "").trim();
        }
      } else if (typeof richParts === 'object' && richParts.text && richParts.text.includes("Oração --->")) {
          // Single object case
          oracaoLabel = "Oração --->";
          richParts.text = richParts.text.replace("Oração --->", "").trim();
          finalRichParts = [richParts];
      }

      // Calculate Height
      let textH = 0;
      if (type !== 'header') {
        const dummyParts = Array.isArray(finalRichParts) ? finalRichParts : [finalRichParts];
         // Using measureAndRender helper which should remain compatible
        textH = measureAndRender(dummyParts, 0, 0, colPartW - 4, 6, true); 
      }
      let h = Math.max(minH, textH + 5);

      if (type === 'header') {
        // Section Header
        const color = richParts.color || colors.black; // handle sectionBgFn(richParts.color)
        drawRect(margin, currentY, contentWidth, 9, sectionBgFn(color), color);
        doc.setTextColor(255, 255, 255); doc.setFontSize(12); doc.setFont("helvetica", "bold");
        doc.text(richParts.text, margin + contentWidth / 2, currentY + 6, { align: "center" });
        currentY += 9;
        return;
      }

      // Normal Row
      // 1. Time
      drawRect(margin, currentY, colTimeW, h, timeBgFn);
      doc.setFontSize(10); doc.setTextColor(...colors.black); doc.setFont("helvetica", "bold");
      if (timeStr) doc.text(timeStr, margin + colTimeW / 2, currentY + h / 2 + 1, { align: "center", baseline: "middle" });

      // 2. Part
      drawRect(margin + colTimeW, currentY, colPartW, h);
      const textYStart = currentY + (h - textH) / 2 - 2; 
      const partsArr = Array.isArray(finalRichParts) ? finalRichParts : [finalRichParts];
      measureAndRender(partsArr, margin + colTimeW + 2, textYStart, colPartW - 4, 6, false);

      if (oracaoLabel) {
        doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(...colors.black);
        doc.text(oracaoLabel, margin + colTimeW + colPartW - 2, currentY + h / 2 + 1, { align: "right", baseline: "middle" });
      }

      // 3. Name
      const colNameX = margin + colTimeW + colPartW;
      
      if (type === 'split' && Array.isArray(nameVal)) {
         const halfH = h / 2;
         // Draw Outer
         drawRect(colNameX, currentY, colNameW, h);
         
         // Top
         drawTextCentered(getName(nameVal[0]), colNameX, currentY, colNameW, halfH, 12);
         
         // Bottom (Arrow Logic)
         const bottomName = getName(nameVal[1]);
         const centerY = currentY + halfH + (halfH / 2);

         if (secondaryLabel) {
             const finalLabel = secondaryLabel.toLowerCase() === 'ajudante' ? 'Ajud.' : secondaryLabel;
             const labelStr = finalLabel;
             const nameStr = bottomName;

             // Measure and Draw Arrow (Using existing large logic block simplified)
             // Reusing the same render logic logic...
             doc.setFontSize(9); doc.setFont("helvetica", "normal");
             const labelW = doc.getTextWidth(labelStr);
             doc.setFontSize(12); doc.setFont("helvetica", "normal");
             const nameW = doc.getTextWidth(nameStr);
             
             const arrowW = 5.5; const gapArrowLabel = 3; const gapLabelName = 2;
             const totalW = arrowW + gapArrowLabel + labelW + gapLabelName + nameW;
             let currentX = colNameX + (colNameW - totalW) / 2;
             
             // Arrow Icon
             const iconLeft = currentX + 0.5;
             doc.setDrawColor(100, 100, 100); doc.setFillColor(100, 100, 100); doc.setLineWidth(0.6); 
             const kneeX = iconLeft + 1; const kneeY = centerY + 1.2; const topY = centerY - 2; const shaftEndX = kneeX + 2.5;
             doc.lines([[0, kneeY - topY], [shaftEndX - kneeX, 0]], kneeX, topY);
             const tipX = shaftEndX + 1.2; const headW = 0.9;
             doc.triangle(shaftEndX, kneeY - headW, shaftEndX, kneeY + headW, tipX, kneeY, 'F');
             
             currentX += arrowW + gapArrowLabel;
             doc.setTextColor(115, 115, 115); doc.setFontSize(9); doc.setFont("helvetica", "normal"); 
             doc.text(labelStr, currentX, centerY, { baseline: 'middle' });
             
             currentX += labelW + gapLabelName;
             doc.setTextColor(0, 0, 0); doc.setFontSize(12); doc.setFont("helvetica", "normal");
             doc.text(nameStr, currentX, centerY, { baseline: 'middle' });
         } else {
             drawTextCentered(bottomName, colNameX, currentY + halfH, colNameW, halfH, 12);
         }
      } else {
         const isPres = (assignments.presidente && getName(nameVal) === getName(assignments.presidente));
         drawRect(colNameX, currentY, colNameW, h, isPres ? highlightBgFn : null);
         drawTextCentered(getName(nameVal), colNameX, currentY, colNameW, h, 12);
      }
      currentY += h;
    };

    // --- PAGE BUILDER ---
    const getDuration = (title) => {
        const m = title.match(/\((\d+)\s*min\)/i);
        return m ? parseInt(m[1]) : 0;
    };
    const formatTime = (min) => {
        const h = Math.floor(min / 60);
        const m = min % 60;
        return `${h}:${m.toString().padStart(2, '0')}`;
    };

    let startMin = 19 * 60 + 30; // 19:30
    let currentMinutes = startMin;

    // 1. Initial
    const initParts = parseRichText(`${schedule.initialSong || schedule.openingSong || "Cântico"}    Oração --->`, 'normal');
    if (initParts[0]) initParts[0] = { ...initParts[0], color: colors.blue, font: "bold" };
    drawRow(formatTime(currentMinutes), initParts, assignments.oracao_inicial);
    currentMinutes += 5;

    // Comentários Iniciais
    const commentsText = schedule.openingComments || 'Comentários Iniciais (1 min)';
    const commentsDuration = getDuration(commentsText) || 1;
    drawRow(formatTime(currentMinutes), parseRichText(commentsText, 'normal'), assignments.comentarios_iniciais);
    currentMinutes += commentsDuration;

    // 2. Treasures
    drawRow('', { text: 'TESOUROS DA PALAVRA DE DEUS', color: colors.blue }, '', 'header'); // BLUE header
    
    schedule.treasures?.forEach((part, idx) => {
        const parts = parseRichText(part.title, 'treasures');
        drawRow(formatTime(currentMinutes), parts, assignments[`tesouro_${idx}`]);
        currentMinutes += getDuration(part.title) + 1; 
    });

    // 3. Ministry
    drawRow('', { text: 'FAÇA SEU MELHOR NO MINISTÉRIO', color: colors.orange }, '', 'header');
    
    schedule.ministry?.forEach((part, idx) => {
        const parts = parseRichText(part.title, 'ministry'); 
        const isDiscurso = part.title.toLowerCase().includes('discurso');
        let assignVal;
        let label = null;
        if (isDiscurso) {
          assignVal = assignments[`ministerio_${idx}`] || assignments[`ministerio_${idx}_1`];
        } else {
          assignVal = [assignments[`ministerio_${idx}_1`] || assignments[`ministerio_${idx}`], assignments[`ministerio_${idx}_2`]];
          label = "Ajudante";
        }
        drawRow(formatTime(currentMinutes), parts, assignVal, isDiscurso ? 'normal' : 'split', label);
        currentMinutes += getDuration(part.title) + 1; 
    });

    // 4. Living
    drawRow('', { text: 'NOSSA VIDA CRISTÃ', color: colors.red }, '', 'header');
    
    drawRow(formatTime(currentMinutes), parseRichText(schedule.middleSong || "Cântico do Meio", 'living'), assignments.cantico_meio);
    currentMinutes += 3;

    schedule.living?.forEach((part, idx) => {
        const parts = parseRichText(part.title, 'living');
        const isBibleStudy = part.title.toLowerCase().includes('estudo bíblico');
        let assignVal;
        let label = null;
        if (isBibleStudy) {
          assignVal = [assignments[`vida_${idx}_1`] || assignments[`vida_${idx}`], assignments[`vida_${idx}_2`]];
          label = "Leitor";
        } else {
          assignVal = assignments[`vida_${idx}`] || assignments[`vida_${idx}_1`]; // needs name
        }
        drawRow(formatTime(currentMinutes), parts, assignVal, isBibleStudy ? 'split' : 'normal', label);
        currentMinutes += getDuration(part.title);
    });

    // Finish
    const finalCommentsText = schedule.finalComments || 'Comentários Finais (3 min)';
    const finalCommentsDuration = getDuration(finalCommentsText) || 3;
    drawRow(formatTime(currentMinutes), parseRichText(finalCommentsText, 'normal'), assignments.comentarios_finais);
    currentMinutes += finalCommentsDuration;

    const finalParts = parseRichText(`${schedule.finalSong}    Oração --->`, 'normal');
    if (finalParts[0]) finalParts[0] = { ...finalParts[0], color: colors.blue, font: "bold" };
    drawRow(formatTime(currentMinutes), finalParts, assignments.oracao_final);

    if (saveInfo) {
       doc.save(`Designacoes_${weekText.replace(/[^a-z0-9]/gi, '_')}.pdf`);
    }
    return doc;
};
