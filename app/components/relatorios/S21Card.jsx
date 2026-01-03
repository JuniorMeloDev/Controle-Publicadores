import React from 'react';

// Constantes de layout para impressão
const ROW_HEIGHT = "h-8";
const COL_WIDTH_MONTH = "w-24";
const COL_WIDTH_DATA = "w-16";
const BORDER_CLASS = "border border-black";

const MONTHS = [
    "Setembro", "Outubro", "Novembro", "Dezembro", "Janeiro", "Fevereiro",
    "Março", "Abril", "Maio", "Junho", "Julho", "Agosto"
];

const formatDate = (dateString) => {
    if (!dateString) return "";
    if (typeof dateString === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
        return dateString;
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString('pt-BR');
};

const CheckboxItem = ({ label, checked }) => (
    <div className="flex items-center gap-1.5">
        <div className={`w-3.5 h-3.5 border border-black flex items-center justify-center ${checked ? 'bg-black text-white' : 'bg-white'}`}>
            {checked && <div className="w-2 h-2 bg-black"></div>}
        </div>
        <span className="leading-none pt-0.5">{label}</span>
    </div>
);

const S21Card = ({ publisherData, serviceYear, isEditing = false, onReportChange }) => {
    const { info, reports } = publisherData;

    const yearReports = reports.filter(r => Number(r.ano_servico) === Number(serviceYear));

    const reportsMap = {};
    yearReports.forEach(r => { reportsMap[r.mes] = r; });

    const totals = yearReports.reduce((acc, curr) => ({
        hours: acc.hours + (Number(curr.horas) || 0),
        studies: acc.studies + (Number(curr.estudos_biblicos) || 0),
    }), { hours: 0, studies: 0 });

    // HANDLERS
    const handleToggle = (mes, field, currentVal) => {
        if (!isEditing || !onReportChange) return;
        onReportChange(mes, field, !currentVal);
    };

    const handleInputChange = (mes, field, value) => {
        if (!isEditing || !onReportChange) return;
        onReportChange(mes, field, value);
    };

    return (
        <div className="w-[95%] max-w-[210mm] border-2 border-black p-4 bg-white text-black font-sans mx-auto page-break-inside-avoid mb-8 print:mb-2 print:break-inside-avoid relative print:w-full print:max-w-none print:mx-0">

            <div className="text-center mb-4">
                <h1 className="uppercase font-extrabold text-xl tracking-wide">REGISTRO DE PUBLICADOR DE CONGREGAÇÃO</h1>
                <p className="font-bold text-base mt-1">Ano de Serviço: {serviceYear}</p>
            </div>

            <div className="border-[3px] border-black p-3 mb-4">

                <div className="flex gap-8 mb-4">
                    <div className="flex-1">
                        <div className="font-bold text-xs mb-1 uppercase">NOME:</div>
                        <div className="border-b border-black text-sm pb-0.5 font-bold uppercase truncate h-6">
                            {info?.nome}
                        </div>
                    </div>
                    <div className="w-1/3">
                        <div className="font-bold text-xs mb-1 uppercase">DATA DE NASCIMENTO:</div>
                        <div className="border-b border-black text-sm pb-0.5 font-bold h-6">
                            {formatDate(info?.nascimento)}
                        </div>
                    </div>
                </div>

                <div className="flex gap-8 mb-4 items-end">
                    <div className="w-1/2">
                        <div className="font-bold text-xs mb-1 uppercase">DATA DE BATISMO:</div>
                        <div className="border-b border-black text-sm pb-0.5 font-bold h-6">
                            {formatDate(info?.batismo)}
                        </div>
                    </div>
                    <div className="w-1/2 grid grid-cols-2 gap-y-1 text-xs font-bold">
                        <CheckboxItem label="Masculino" checked={info?.sexo === 'Masculino'} />
                        <CheckboxItem label="Feminino" checked={info?.sexo === 'Feminino'} />
                        <CheckboxItem label="Outras Ovelhas" checked={info?.esperanca === 'Outras Ovelhas'} />
                        <CheckboxItem label="Ungido" checked={info?.esperanca === 'Ungido'} />
                    </div>
                </div>

                <div className="flex justify-between border-t border-gray-300 pt-3 mt-2 text-xs font-bold">
                    <CheckboxItem label="Ancião" checked={info?.privilegios?.includes('anciao')} />
                    <CheckboxItem label="Servo Ministerial" checked={info?.privilegios?.includes('servo_ministerial')} />
                    <CheckboxItem label="Pioneiro Regular" checked={info?.designacoes?.includes('pioneiro_regular')} />
                    <CheckboxItem label="Pioneiro Especial" checked={false} />
                    <CheckboxItem label="Missionário" checked={false} />
                </div>
            </div>

            <table className="w-full border-collapse border-2 border-black text-center text-sm">
                <thead>
                    <tr className="bg-blue-50">
                        <th className={`${BORDER_CLASS} ${COL_WIDTH_MONTH} py-2 font-bold bg-blue-50`}>Ano de serviço</th>
                        <th className={`${BORDER_CLASS} w-24 leading-none py-1`}>Participou no ministério</th>
                        <th className={`${BORDER_CLASS} ${COL_WIDTH_DATA} leading-none py-1`}>Estudos bíblicos</th>
                        <th className={`${BORDER_CLASS} w-20 leading-none py-1`}>Pioneiro auxiliar</th>
                        <th className={`${BORDER_CLASS} w-24 px-1 leading-none py-1`}>
                            <span className="block font-bold">Horas</span>
                            <span className="block text-[9px] font-normal">(Se for pioneiro ou missionário em campo)</span>
                        </th>
                        <th className={`${BORDER_CLASS} flex-1 font-bold`}>Observações</th>
                    </tr>
                </thead>
                <tbody>
                    {MONTHS.map(month => {
                        const report = reportsMap[month];
                        const participou = report?.participou_ministerio || (report && (report.publicacoes > 0 || report.videos > 0 || report.horas > 0 || report.revisitas > 0));
                        const aux = report?.pioneiro_auxiliar;

                        return (
                            <tr key={month} className={ROW_HEIGHT}>
                                <td className={`${BORDER_CLASS} font-bold text-left px-2 bg-blue-50`}>{month}</td>

                                {/* Participou */}
                                <td className={BORDER_CLASS} onClick={() => handleToggle(month, 'participou_ministerio', participou)}>
                                    <div className={`flex justify-center items-center h-full ${isEditing ? 'cursor-pointer hover:bg-gray-100' : ''}`}>
                                        {participou ? (
                                            <div className="w-4 h-4 border border-black flex items-center justify-center bg-black">
                                                {/* Opcional: Icon check branco se quiser */}
                                            </div>
                                        ) : (
                                            <div className={`w-4 h-4 border ${isEditing ? 'border-gray-400 bg-white' : 'border-gray-300'}`}></div>
                                        )}
                                    </div>
                                </td>

                                {/* Estudos */}
                                <td className={`${BORDER_CLASS} p-0`}>
                                    {isEditing ? (
                                        <input
                                            type="number"
                                            className="w-full h-full text-center border-none focus:ring-2 focus:ring-inset focus:ring-purple-500 p-0 text-sm"
                                            value={report?.estudos_biblicos || ''}
                                            onChange={(e) => handleInputChange(month, 'estudos_biblicos', e.target.value)}
                                        />
                                    ) : (
                                        report?.estudos_biblicos || ''
                                    )}
                                </td>

                                {/* Pioneiro Aux */}
                                <td className={BORDER_CLASS} onClick={() => handleToggle(month, 'pioneiro_auxiliar', aux)}>
                                    <div className={`flex justify-center items-center h-full ${isEditing ? 'cursor-pointer hover:bg-gray-100' : ''}`}>
                                        {aux ? (
                                            <div className="w-4 h-4 border border-black flex items-center justify-center bg-black"></div>
                                        ) : (
                                            <div className={`w-4 h-4 border ${isEditing ? 'border-gray-400 bg-white' : 'border-gray-300'}`}></div>
                                        )}
                                    </div>
                                </td>

                                {/* Horas */}
                                <td className={`${BORDER_CLASS} p-0`}>
                                    {isEditing ? (
                                        <input
                                            type="number"
                                            className="w-full h-full text-center border-none focus:ring-2 focus:ring-inset focus:ring-purple-500 p-0 text-sm"
                                            value={report?.horas || ''}
                                            onChange={(e) => handleInputChange(month, 'horas', e.target.value)}
                                        />
                                    ) : (
                                        report?.horas || ''
                                    )}
                                </td>

                                {/* Observações */}
                                <td className={`${BORDER_CLASS} text-left px-2 text-xs p-0`}>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            className="w-full h-full border-none focus:ring-2 focus:ring-inset focus:ring-purple-500 px-2 text-xs"
                                            value={report?.observacoes || ''}
                                            onChange={(e) => handleInputChange(month, 'observacoes', e.target.value)}
                                        />
                                    ) : (
                                        report?.observacoes || ''
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                    {/* LINHA DE TOTAIS */}
                    <tr className={`${ROW_HEIGHT} font-bold bg-blue-50`}>
                        <td className={`${BORDER_CLASS} text-right px-2 uppercase`}>Total</td>
                        <td className={`${BORDER_CLASS} bg-gray-200`}></td>
                        <td className={BORDER_CLASS}>{totals.studies || ''}</td>
                        <td className={`${BORDER_CLASS} bg-gray-200`}></td>
                        <td className={BORDER_CLASS}>{totals.hours || ''}</td>
                        <td className={`${BORDER_CLASS} bg-gray-200`}></td>
                    </tr>
                </tbody>
            </table>

            <div className="mt-2 text-[10px] text-gray-500 text-center">
                Impresso via Sistema de Gestão Congregacional
            </div>
        </div>
    );
};

export default S21Card;
