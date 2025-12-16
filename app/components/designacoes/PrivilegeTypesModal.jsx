
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Loader2, Plus, Trash2, Save, GripVertical, AlertTriangle } from 'lucide-react';

export function PrivilegeTypesModal({ open, onOpenChange, onUpdate }) {
    const [types, setTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Edit State
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');

    // New State
    const [newName, setNewName] = useState('');

    // Delete Confirmation State
    const [pendingDeleteId, setPendingDeleteId] = useState(null);

    useEffect(() => {
        if (open) fetchTypes();
    }, [open]);

    async function fetchTypes() {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/privilegios/tipos');
            if(res.ok) setTypes(await res.json());
        } catch(e) { console.error(e); }
        finally { setLoading(false); }
    }

    async function handleAdd() {
        if(!newName.trim()) return;
        setSaving(true);
        try {
            const res = await fetch('/api/admin/privilegios/tipos', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ nome: newName })
            });
            if(res.ok) {
                setNewName('');
                fetchTypes();
                onUpdate();
            }
        } finally { setSaving(false); }
    }

    async function handleUpdate(id) {
        if(!editName.trim()) return;
        try {
            const res = await fetch('/api/admin/privilegios/tipos', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ id, nome: editName })
            });
            if(res.ok) {
                setEditingId(null);
                fetchTypes();
                onUpdate();
            }
        } catch(e) { console.error(e); }
    }

    function handleDeleteClick(id) {
        setPendingDeleteId(id);
    }

    async function confirmDelete() {
        if (!pendingDeleteId) return;
        try {
            await fetch(`/api/admin/privilegios/tipos?id=${pendingDeleteId}`, { method: 'DELETE' });
            fetchTypes();
            onUpdate();
        } catch(e) { console.error(e); }
        finally { setPendingDeleteId(null); }
    }

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="bg-white sm:max-w-md text-gray-900">
                    <DialogHeader>
                        <DialogTitle>Gerenciar Tipos de Privilégios</DialogTitle>
                    </DialogHeader>
                    
                    <div className="py-4 space-y-4">
                        {/* ADD NEW */}
                        <div className="flex gap-2 items-end">
                            <div className="flex-1 space-y-1">
                                <Label className="text-xs font-semibold text-gray-700">Novo Privilégio</Label>
                                <Input 
                                    value={newName} 
                                    onChange={e => setNewName(e.target.value)} 
                                    placeholder="Ex: Microfone 1"
                                    className="text-gray-900 border-gray-300 focus:border-purple-500" 
                                />
                            </div>
                            <Button onClick={handleAdd} disabled={saving || !newName} className="bg-purple-600 hover:bg-purple-700">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            </Button>
                        </div>

                        <div className="border-t border-gray-100 my-2"></div>

                        {/* LIST */}
                        {loading ? (
                            <div className="flex justify-center p-4"><Loader2 className="animate-spin text-purple-600" /></div>
                        ) : (
                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                {types.map(t => (
                                    <div key={t.id} className="flex items-center gap-2 p-2 bg-white rounded-md border border-gray-200 shadow-sm">
                                        <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
                                        
                                        {editingId === t.id ? (
                                            <div className="flex-1 flex gap-2">
                                                <Input 
                                                    value={editName} 
                                                    onChange={e => setEditName(e.target.value)} 
                                                    className="h-8 text-sm text-gray-900 font-medium" 
                                                    autoFocus
                                                />
                                                <Button size="sm" onClick={() => handleUpdate(t.id)} className="bg-green-600 hover:bg-green-700 h-8 w-8 p-0">
                                                    <Save className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex-1 text-sm font-bold text-gray-800 cursor-pointer hover:text-purple-600" onClick={() => { setEditingId(t.id); setEditName(t.nome); }}>
                                                {t.nome}
                                            </div>
                                        )}

                                        <Button 
                                            variant="ghost" 
                                            onClick={() => handleDeleteClick(t.id)}
                                            className="text-gray-400 hover:text-red-600 h-8 w-8 p-0"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                                {types.length === 0 && <p className="text-center text-sm text-gray-500 font-medium">Nenhum privilégio cadastrado.</p>}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
            
            {/* DELETE CONFIRMATION DIALOG */}
            <Dialog open={!!pendingDeleteId} onOpenChange={(val) => !val && setPendingDeleteId(null)}>
                <DialogContent className="bg-white sm:max-w-[400px] text-gray-900">
                    <DialogHeader className="flex flex-col items-center gap-2">
                         <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mb-2">
                            <AlertTriangle className="h-6 w-6 text-red-600" />
                         </div>
                        <DialogTitle className="text-xl text-center">Excluir Privilégio?</DialogTitle>
                    </DialogHeader>
                    
                    <div className="py-2 text-center text-gray-600 text-sm">
                        <p>Isso removerá este privilégio de todas as reuniões passadas.</p> 
                        <p className="font-semibold text-gray-800 mt-2">Esta ação não pode ser desfeita.</p>
                    </div>

                    <DialogFooter className="flex gap-2 sm:justify-center mt-4">
                        <Button variant="outline" onClick={() => setPendingDeleteId(null)} className="flex-1 border-gray-300 text-gray-700">
                            Cancelar
                        </Button>
                        <Button onClick={confirmDelete} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                            Sim, Excluir
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
