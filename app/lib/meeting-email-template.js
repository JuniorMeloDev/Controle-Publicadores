export const normalizeText = (text) => {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

export const formatName = (fullName, nameMap) => {
  if (!fullName || fullName === '---') return '';
  if (nameMap.has(fullName)) return nameMap.get(fullName);
  const parts = fullName.split(' ').filter(Boolean);
  if (parts.length <= 1) return fullName;
  return `${parts[0]} ${parts[parts.length - 1]}`;
};

export function generateMeetingHtml(weekText, schedule, assignments, nameMap) {
  const sTable = 'width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 14px; border: 2px solid #000;';
  const sHeaderTitle = 'background-color: #f3f4f6; padding: 10px; text-align: center; border-right: 2px solid #000; width: 65%;';
  const sHeaderRoles = 'width: 35%; padding: 0; vertical-align: top;';
  const sHeaderRolesTitle = 'background-color: #e5e7eb; padding: 5px; font-weight: bold; text-align: center; border-bottom: 1px solid #000; font-size: 12px;';
  const sHeaderRoleLabel = 'padding: 4px 8px; font-size: 13px; font-weight: bold; width: 80px;';
  const sHeaderRoleValue = 'padding: 4px 8px; font-size: 13px; font-weight: bold;';

  const sSection = 'background-color: #1e3a8a; color: white; font-weight: bold; padding: 5px 10px; text-transform: uppercase; border: 1px solid #000; text-align: center;';
  const sTime = 'width: 60px; padding: 8px; border: 1px solid #000; background-color: #e5e7eb; text-align: center; font-weight: bold; color: #000;';
  const sPart = 'padding: 8px; border: 1px solid #000; color: #000;';
  const sName = 'width: 30%; padding: 8px; border: 1px solid #000; font-weight: bold; text-align: center; color: #000; vertical-align: middle;';

  const headerHtml = `
    <table style="width: 100%; border: 2px solid #000; border-bottom: none; border-collapse: collapse; font-family: Arial, sans-serif;">
      <tr>
        <td style="${sHeaderTitle}">
           <h2 style="margin:0; color:#1e3a8a; text-transform: uppercase;">${weekText}</h2>
           <p style="margin:5px 0 0; font-size: 16px;">Nossa Vida e Ministério Cristão</p>
        </td>
        <td style="${sHeaderRoles}">
           <div style="${sHeaderRolesTitle}">Salão Principal</div>
           <table style="width: 100%; border-collapse: collapse;">
             <tr>
               <td style="${sHeaderRoleLabel}">Presidente:</td>
               <td style="${sHeaderRoleValue}">${formatName(assignments['presidente'], nameMap)}</td>
             </tr>
             <tr>
               <td style="${sHeaderRoleLabel}">Ajudante:</td>
               <td style="${sHeaderRoleValue}">${formatName(assignments['ajudante'], nameMap)}</td>
             </tr>
           </table>
        </td>
      </tr>
    </table>
  `;

  const formatTime = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
  };

  const getDuration = (text) => {
    if (!text) return 0;
    const match = text.match(/\((\d+)\s*min\)/i);
    if (match) return parseInt(match[1], 10);
    return 0;
  };

  const formatDual = (mainLabel, mainVal, subLabel, subVal) => {
    const main = formatName(mainVal, nameMap);
    const sub = formatName(subVal, nameMap);
    if (sub && sub !== '---') {
      return `
        <div><strong>${mainLabel}:</strong> ${main || '---'}</div>
        <div style="border-top: 1px dashed #9ca3af; margin-top: 4px; padding-top: 4px;">
          <strong>${subLabel}:</strong> ${sub || '---'}
        </div>
      `;
    }
    return main || '---';
  };

  let rows = '';
  let currentMinutes = 19 * 60 + 30;
  const initialSong = schedule.initialSong || schedule.openingSong || 'Cântico';

  rows += `
    <tr>
      <td style="${sTime}">${formatTime(currentMinutes)}</td>
      <td style="${sPart}"><span style="color: #1e40af; font-weight: bold;">${initialSong}</span> <span style="float: right;">Oração Inicial &rarr;</span></td>
      <td style="${sName}">${formatName(assignments['oracao_inicial'], nameMap)}</td>
    </tr>
  `;
  currentMinutes += 5;

  const commentsText = schedule.openingComments || 'Comentários Iniciais (1 min)';
  const commentsDuration = getDuration(commentsText) || 1;
  rows += `
    <tr>
      <td style="${sTime}">${formatTime(currentMinutes)}</td>
      <td style="${sPart}"><strong>${commentsText}</strong></td>
      <td style="${sName}">${formatName(assignments['comentarios_iniciais'], nameMap)}</td>
    </tr>
  `;
  currentMinutes += commentsDuration;

  rows += `<tr><td colspan="3" style="${sSection}">TESOUROS DA PALAVRA DE DEUS</td></tr>`;
  schedule.treasures?.forEach((part, idx) => {
    rows += `<tr><td style="${sTime}">${formatTime(currentMinutes)}</td><td style="${sPart}">${part.title}</td><td style="${sName}">${formatName(assignments['tesouro_' + idx], nameMap)}</td></tr>`;
    currentMinutes += getDuration(part.title) + 1;
  });
  if (assignments.leitura_biblia) {
    const bibleText = 'Leitura da Bíblia (4 min)';
    rows += `<tr><td style="${sTime}">${formatTime(currentMinutes)}</td><td style="${sPart}">${bibleText}</td><td style="${sName}">${formatName(assignments['leitura_biblia'], nameMap)}</td></tr>`;
    currentMinutes += getDuration(bibleText) + 1;
  }

  rows += `<tr><td colspan="3" style="${sSection}">FAÇA SEU MELHOR NO MINISTÉRIO</td></tr>`;
  schedule.ministry?.forEach((part, idx) => {
    const isDiscurso = part.title.toLowerCase().includes('discurso');
    let assignedHtml = '';
    if (isDiscurso) {
      assignedHtml = formatName(assignments['ministerio_' + idx], nameMap);
    } else {
      assignedHtml = formatDual('Estudante', assignments['ministerio_' + idx + '_1'], 'Ajudante', assignments['ministerio_' + idx + '_2']);
    }
    rows += `<tr><td style="${sTime}">${formatTime(currentMinutes)}</td><td style="${sPart}">${part.title}</td><td style="${sName}">${assignedHtml}</td></tr>`;
    currentMinutes += getDuration(part.title) + 1;
  });

  rows += `<tr><td colspan="3" style="${sSection}">NOSSA VIDA CRISTÃ</td></tr>`;
  rows += `<tr><td style="${sTime}">${formatTime(currentMinutes)}</td><td style="${sPart}"><span style="color: #1e40af; font-weight: bold;">${schedule.middleSong || 'Cântico'}</span></td><td style="${sName}">${formatName(assignments['cantico_meio'], nameMap)}</td></tr>`;
  currentMinutes += 3;

  schedule.living?.forEach((part, idx) => {
    const isBibleStudy = normalizeText(part.title).includes('estudo biblico');
    let assignedHtml = '';
    if (isBibleStudy) {
      assignedHtml = formatDual('Dirigente', assignments['vida_' + idx + '_1'], 'Leitor', assignments['vida_' + idx + '_2']);
    } else {
      assignedHtml = formatName(assignments['vida_' + idx], nameMap);
    }
    rows += `<tr><td style="${sTime}">${formatTime(currentMinutes)}</td><td style="${sPart}">${part.title}</td><td style="${sName}">${assignedHtml}</td></tr>`;
    currentMinutes += getDuration(part.title);
  });

  const finalCommentsText = schedule.finalComments || 'Comentários Finais (3 min)';
  const finalCommentsDuration = getDuration(finalCommentsText) || 3;
  rows += `
    <tr>
      <td style="${sTime}">${formatTime(currentMinutes)}</td>
      <td style="${sPart}"><strong>${finalCommentsText}</strong></td>
      <td style="${sName}">${formatName(assignments['comentarios_finais'], nameMap)}</td>
    </tr>
  `;
  currentMinutes += finalCommentsDuration;

  rows += `
    <tr>
      <td style="${sTime}">${formatTime(currentMinutes)}</td>
      <td style="${sPart}"><span style="color: #1e40af; font-weight: bold;">${schedule.finalSong || ''}</span> <span style="float: right;">Oração Final &rarr;</span></td>
      <td style="${sName}">${formatName(assignments['oracao_final'], nameMap)}</td>
    </tr>
  `;

  return `
    ${headerHtml}
    <table style="${sTable}">
      <tbody>${rows}</tbody>
    </table>
  `;
}

export const getPartTitlesMap = (scheduleData) => {
  const titles = {};
  titles['presidente'] = 'Presidente';
  titles['ajudante'] = 'Ajudante';
  titles['oracao_inicial'] = 'Oração Inicial';
  titles['oracao_final'] = 'Oração Final';
  titles['comentarios_iniciais'] = scheduleData.openingComments || 'Comentários Iniciais';
  titles['comentarios_finais'] = scheduleData.finalComments || 'Comentários Finais';
  titles['cantico_meio'] = scheduleData.middleSong || 'Cântico do Meio';

  scheduleData.treasures?.forEach((part, index) => {
    titles['tesouro_' + index] = part.title;
  });

  scheduleData.ministry?.forEach((part, index) => {
    const isDiscurso = part.title.toLowerCase().includes('discurso');
    if (isDiscurso) {
      titles['ministerio_' + index] = part.title;
    } else {
      titles['ministerio_' + index + '_1'] = part.title;
      titles['ministerio_' + index + '_2'] = part.title;
    }
  });

  scheduleData.living?.forEach((part, index) => {
    const isBibleStudy = normalizeText(part.title).includes('estudo biblico');
    if (isBibleStudy) {
      titles['vida_' + index + '_1'] = part.title;
      titles['vida_' + index + '_2'] = part.title;
    } else {
      titles['vida_' + index] = part.title;
    }
  });

  return titles;
};

export function getFriendlyTitleWithSection(key, schedule) {
  if (key === 'presidente') return 'Presidente';
  if (key === 'ajudante') return 'Ajudante';
  if (key === 'oracao_inicial') return 'REUNIÃO - Oração Inicial';
  if (key === 'oracao_final') return 'REUNIÃO - Oração Final';
  if (key === 'comentarios_iniciais') return 'REUNIÃO - Comentários Iniciais';
  if (key === 'comentarios_finais') return 'REUNIÃO - Comentários Finais';
  if (key === 'cantico_meio') return 'NOSSA VIDA CRISTÃ - Cântico do Meio';

  if (key.startsWith('tesouro_')) {
    const idx = parseInt(key.split('_')[1], 10);
    const title = schedule.treasures[idx]?.title || 'Parte';
    return `TESOUROS DA PALAVRA DE DEUS - ${title}`;
  }
  if (key.startsWith('ministerio_')) {
    const parts = key.split('_');
    const idx = parseInt(parts[1], 10);
    const suffix = parts[2];
    const baseTitle = schedule.ministry[idx]?.title || 'Parte';
    const role = suffix === '1' ? ' (Estudante)' : (suffix === '2' ? ' (Ajudante)' : '');
    return `FAÇA SEU MELHOR NO MINISTÉRIO - ${baseTitle}${role}`;
  }
  if (key.startsWith('vida_')) {
    const parts = key.split('_');
    const idx = parseInt(parts[1], 10);
    const suffix = parts[2];
    const baseTitle = schedule.living[idx]?.title || 'Parte';
    if (normalizeText(baseTitle).includes('estudo biblico')) {
      const role = suffix === '1' ? ' (Dirigente)' : ' (Leitor)';
      return `NOSSA VIDA CRISTÃ - ${baseTitle}${role}`;
    }
    return `NOSSA VIDA CRISTÃ - ${baseTitle}`;
  }
  return key;
}
