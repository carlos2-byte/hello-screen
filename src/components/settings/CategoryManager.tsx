import { useState, useEffect } from 'react';
import { Plus, Trash2, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  CustomCategory,
  getCustomCategories,
  addCustomCategory,
  deleteCustomCategory,
  getAllTransactions,
} from '@/lib/storage';
import { toast } from '@/hooks/use-toast';

export function CategoryManager() {
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<CustomCategory | null>(null);
  const [hasLinkedTx, setHasLinkedTx] = useState(false);

  const loadCategories = async () => {
    const cats = await getCustomCategories();
    setCustomCategories(cats);
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleAdd = async () => {
    const name = newCatName.trim();
    if (!name) return;

    const id = `custom_${Date.now()}`;
    const cat: CustomCategory = {
      id,
      name,
      icon: 'Tag',
      type: 'expense',
      color: `hsl(${Math.floor(Math.random() * 360)}, 55%, 55%)`,
    };

    await addCustomCategory(cat);
    setNewCatName('');
    await loadCategories();
    toast({ title: `Categoria "${name}" criada` });
  };

  const handleDeleteClick = async (cat: CustomCategory) => {
    const txs = await getAllTransactions();
    const linked = txs.some(tx => tx.category === cat.id);
    setHasLinkedTx(linked);
    setDeleteTarget(cat);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteCustomCategory(deleteTarget.id);
    setDeleteTarget(null);
    await loadCategories();
    toast({ title: `Categoria "${deleteTarget.name}" excluída` });
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            Categorias de Despesa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              placeholder="Nova categoria..."
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <Button size="icon" onClick={handleAdd} disabled={!newCatName.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {customCategories.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Categorias personalizadas</Label>
              {customCategories.map(cat => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between p-2 rounded-lg border bg-muted/20"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-sm">{cat.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteClick(cat)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {customCategories.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Nenhuma categoria personalizada criada
            </p>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {hasLinkedTx
                ? 'Existem despesas vinculadas a esta categoria. Ao excluí-la, essas despesas ficarão sem categoria definida.'
                : 'Esta categoria será removida permanentemente.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
