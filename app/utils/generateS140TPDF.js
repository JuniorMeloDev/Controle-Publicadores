import jsPDF from 'jspdf';

export const generateS140TPDF = (detailsList) => {
    // detailsList: Array of { schedule, assignments, weekDescription, ... }
    
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Config
    const margin = 10;
    const pageWidth = 210;
    const pageHeight = 297;
    const halfPageHeight = pageHeight / 2; // ~148.5
    
    // Colors
    const colors = {
        gray: { bg: [80, 80, 80], text: [255, 255, 255] },
        brown: { bg: [180, 100, 0], text: [255, 255, 255] },
        red: { bg: [140, 0, 0], text: [255, 255, 255] },
        black: [0, 0, 0]
    };

    const congName = process.env.NEXT_PUBLIC_NOME_CONGREGACAO || "Congregação";
    
    // Helpers
    const getName = (val) => {
        if(val && typeof val === 'object' && val.name) return val.name; 
        return val || "";
    };

    // Time Helpers
    const formatTime = (minutes) => {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const getDuration = (text) => {
        const match = text.match(/\((\d+)\s*min\)/i);
        return match ? parseInt(match[1], 10) : 0;
    };

    // Draw Function for one meeting block
    const drawMeetingBlock = (data, startY) => {
        const { schedule, assignments, weekDescription } = data;
        let currentY = startY;

        // Init Time: 19:30
        let currentMinutes = (19 * 60) + 30;

        // Check if Sala B should be shown
        // Logic: Show if 'conselheiro_b' is assigned.
        const conselheiroB = getName(assignments.conselheiro_b);
        const hasSalaB = !!conselheiroB;

        // --- Header ---
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.text(congName.toUpperCase(), margin, currentY + 5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        const titleText = "Programação da reunião do meio de semana";
        const titleW = doc.getTextWidth(titleText);
        doc.text(titleText, pageWidth - margin - titleW, currentY + 5);

        // Underline full width
        doc.setLineWidth(0.5);
        doc.line(margin, currentY + 7, pageWidth - margin, currentY + 7);
        currentY += 12;

        // Subheader
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        const subHeader = `${weekDescription.toUpperCase()} | LEITURA SEMANAL DA BÍBLIA`;
        const splitSub = doc.splitTextToSize(subHeader, 130);
        doc.text(splitSub, margin, currentY);
        
        // Right side info (Pres, Cons)
        // Adjust infoX to avoid overlap
        const infoX = 145; 
        const lineH = 4.5;
        let infoY = currentY - 2; // align top with subheader

        // Function to draw label/val pair
        const drawLabelVal = (label, val, yPos) => {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.text(label, infoX, yPos, { align: 'right' }); 
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            const valX = infoX + 2;
            const maxValW = pageWidth - margin - valX; 
            const splitVal = doc.splitTextToSize(val || "", maxValW);
            doc.text(splitVal, valX, yPos);
            
            return splitVal.length * 4; // return height used
        };

        // 1. Presidente
        const presHeight = drawLabelVal("Presidente:", getName(assignments.presidente), infoY);
        infoY += Math.max(lineH, presHeight);

        // 2. Conselheiro Sala B (Conditional)
        if (hasSalaB) {
            const consHeight = drawLabelVal("Conselheiro da sala B:", conselheiroB, infoY);
            infoY += Math.max(lineH, consHeight);
        }
        
        // Header height adjustment
        currentY = Math.max(currentY + 5, infoY + 5);

        // --- Opening ---
        const drawSimpleRow = (time, text) => {
             doc.setFont("helvetica", "bold");
             doc.setFontSize(9);
             doc.setTextColor(100); 
             doc.text(time, margin, currentY);
             
             doc.setTextColor(0);
             doc.text("•", margin + 12, currentY);
             
             doc.text(text, margin + 16, currentY);
        };
        
        // Opening Song & Opening Prayer
        const initialSongRaw = schedule.initialSong || schedule.openingSong || "";
        const songNum = initialSongRaw.replace(/\D/g, ''); 
        
        // Draw Song (Left)
        drawSimpleRow(formatTime(currentMinutes), `Cântico ${songNum || "---"}`);

        // Draw Prayer (Right, Same Line)
        const openingPrayerName = getName(assignments.oracao_inicial);
        // We use the same infoX for alignment consistency
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text("Oração:", infoX, currentY, { align: 'right' }); 
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        const maxPrayerW = pageWidth - margin - (infoX + 2);
        doc.text(openingPrayerName, infoX + 2, currentY);

        currentY += 5;
        currentMinutes += 5;

        // Initial Comments
        drawSimpleRow(formatTime(currentMinutes), `Comentários iniciais (1 min)`);
        currentY += 5;
        currentMinutes += 1;

        currentY += 2;

        // SECTIONS Helpers
        const salaBX = 120;
        const mainHallX = 160;

        const drawSectionHeader = (title, colorObj) => {
            doc.setFillColor(...colorObj.bg);
            doc.rect(margin, currentY - 3.5, 90, 5, 'F'); 
            
            doc.setTextColor(...colorObj.text);
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text(title, margin + 2, currentY);
            
            // Labels
            doc.setTextColor(0);
            doc.setFontSize(7);
            if (hasSalaB) {
                // Show 'Sala B' label if relevant
                doc.text("Sala B", salaBX, currentY);
            }
            doc.text("Salão principal", mainHallX, currentY);
            
            currentY += 6;
        };

        const drawPartRow = (time, numStr, assignmentsMain, assignmentB = null, label = null) => {
            // Setup Fonts
            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            
            // 1. Title Lines
            const maxTitleW = 85; 
            const splitTitle = doc.splitTextToSize(numStr, maxTitleW);
            
            // 2. Name Lines (Main Hall)
            const maxNameW = pageWidth - margin - mainHallX; // ~40mm
            let splitName = [];
            let nameText = "";

            if (assignmentsMain) {
                if (Array.isArray(assignmentsMain)) {
                     const n1 = getName(assignmentsMain[0]);
                     const n2 = getName(assignmentsMain[1]);
                     nameText = n2 ? `${n1} / ${n2}` : n1;
                } else {
                    nameText = getName(assignmentsMain);
                }
                
                if (nameText) {
                    splitName = doc.splitTextToSize(nameText, maxNameW);
                }
            }

            // Calculate Row Height
            const titleH = splitTitle.length * 4;
            const nameH = splitName.length * 4;
            const rowH = Math.max(titleH, nameH, 5); 

            // -- RENDER --
            
            // Time
            doc.setTextColor(100);
            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            doc.text(time, margin, currentY);

            // Part Title
            doc.setTextColor(0);
            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            doc.text(splitTitle, margin + 10, currentY);
            
            // Assignments Main
            if (nameText) {
                 if (label) {
                    // Render Label: "Estudante/ajudante:" (Right aligned to Sala B col)
                    doc.setFontSize(7);
                    doc.setFont("helvetica", "bold");
                    doc.text(label + ":", salaBX - 2, currentY, { align: 'right' });
                 }
                 // Render Name
                 doc.setFontSize(9);
                 doc.setFont("helvetica", "normal");
                 doc.text(splitName, mainHallX, currentY);
            }

            // Update Y
            currentY += rowH + 2; 
        };

        // --- TREASURES ---
        drawSectionHeader("TESOUROS DA PALAVRA DE DEUS", colors.gray);
        
        schedule.treasures?.forEach((part, idx) => {
             drawPartRow(formatTime(currentMinutes), part.title, assignments[`tesouro_${idx}`]);
             const dur = getDuration(part.title);
             currentMinutes += dur + 1; 
        });
        
        // --- MINISTRY ---
        drawSectionHeader("FAÇA SEU MELHOR NO MINISTÉRIO", colors.brown);
        schedule.ministry?.forEach((part, idx) => {
             const isDiscurso = part.title.toLowerCase().includes('discurso');
             // Show label only if Discourse is false? Logic: Discurso has no student/assistant label usually.
             const label = isDiscurso ? null : "";
             
             let val;
             if (isDiscurso) {
                 val = assignments[`ministerio_${idx}`] || assignments[`ministerio_${idx}_1`];
             } else {
                 val = [
                     assignments[`ministerio_${idx}_1`] || assignments[`ministerio_${idx}`],
                     assignments[`ministerio_${idx}_2`]
                 ];
             }
             drawPartRow(formatTime(currentMinutes), part.title, val, null, label);
             const dur = getDuration(part.title);
             currentMinutes += dur + 1;
        });

        // --- LIVING ---
        drawSectionHeader("NOSSA VIDA CRISTÃ", colors.red);
        
        // Middle Song
        const songMidNum = (schedule.middleSong || "").replace(/\D/g, '');
        drawSimpleRow(formatTime(currentMinutes), `Cântico ${songMidNum || "---"}`);
        currentY += 5; // Manually increment since drawSimpleRow doesn't for flexibility
        // Time logic: song is 3 mins, but we added a transition before?
        // Standard loop adds 'dur + 1'. Song is usually 3-5 mins + transition. 
        // Let's emulate standard logic: 
        currentMinutes += 5; // Song duration + transition

        schedule.living?.forEach((part, idx) => {
            const isBibleStudy = part.title.toLowerCase().includes('estudo bíblico');
            const label = isBibleStudy ? "" : null;
            let val;
            if (isBibleStudy) {
                 val = [
                     assignments[`vida_${idx}_1`] || assignments[`vida_${idx}`],
                     assignments[`vida_${idx}_2`]
                 ];
            } else {
                 val = assignments[`vida_${idx}`] || assignments[`vida_${idx}_1`];
            }
            drawPartRow(formatTime(currentMinutes), part.title, val, null, label);
            const dur = getDuration(part.title);
            currentMinutes += dur + 1;
        });
        
        // Final Comments
        drawSimpleRow(formatTime(currentMinutes), "Comentários finais (3 min)");
        currentY += 5;
        currentMinutes += 3;
        
        // Final Song & Payment
        const songEndNum = (schedule.finalSong || "").replace(/\D/g, '');
        
        doc.setTextColor(100);
        doc.setFontSize(8);
        doc.text(formatTime(currentMinutes), margin, currentY); 
        
        doc.setTextColor(0);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("•", margin + 12, currentY);
        doc.text(`Cântico ${songEndNum || "---"}`, margin + 16, currentY);
        
        // Prayer right aligned
        const finalPrayerName = getName(assignments.oracao_final);
        doc.setFontSize(7);
        doc.text("Oração:", salaBX - 2, currentY, { align: 'right' });
        
        // Wrap Prayer Name
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        const maxFinalPrayerW = pageWidth - margin - mainHallX;
        const splitFinalPrayer = doc.splitTextToSize(finalPrayerName || "", maxFinalPrayerW);
        doc.text(splitFinalPrayer, mainHallX, currentY);
    };

    // --- Main Loop ---
    for (let i = 0; i < detailsList.length; i += 2) {
        if (i > 0) doc.addPage();
        
        const m1 = detailsList[i];
        const m2 = detailsList[i+1];
        
        if (m1) drawMeetingBlock(m1, margin);
        // margin = 10mm
        
        // Divider
        doc.setDrawColor(150);
        doc.setLineWidth(0.2);
        doc.setLineDash([2, 2], 0);
        doc.line(margin, halfPageHeight, pageWidth - margin, halfPageHeight);
        doc.setLineDash([], 0);

        if (m2) drawMeetingBlock(m2, halfPageHeight + margin);
    }
    
    doc.save("S-140-T_Designacoes.pdf");
};
