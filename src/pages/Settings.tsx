import { useState } from "react";
import { Plus, Trash2, Edit, Shield, Save, User as UserLucide, Sun, Moon, Monitor } from "lucide-react";
import { useTheme, type Theme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { users as mockUsers } from "@/lib/mock";
import { useAuth } from "@/contexts/AuthContext";
import type { User, UserRole } from "@/types";
import { initials } from "@/lib/format";

function UserFormDialog({
  open,
  onClose,
  onSubmit,
  initialData,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<User> & { password?: string }) => void;
  initialData?: User | null;
}) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [username, setUsername] = useState(initialData?.username ?? "");
  const [role, setRole] = useState<UserRole>(initialData?.role ?? "member");
  const [password, setPassword] = useState("");
  const isEditing = !!initialData;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, username, role, password: password || undefined });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit User" : "Tambah User"}</DialogTitle>
          <DialogDescription>{isEditing ? "Ubah data user" : "Buat user baru"}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="su-name">Nama</Label>
            <Input id="su-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="cth: Operator C" autoFocus disabled={isEditing} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="su-username">Username</Label>
            <Input id="su-username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="cth: operator_c" maxLength={20} />
          </div>
          <div className="grid gap-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="leader">Leader</SelectItem>
                <SelectItem value="member">Member</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="su-password">Password {isEditing ? "(kosongkan jika tidak diubah)" : ""}</Label>
            <Input id="su-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isEditing ? "Biarkan kosong untuk tidak mengubah" : "password123"} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!name.trim() || !username.trim() || (!isEditing && !password)}>
              {isEditing ? <Save className="h-4 w-4 mr-2" /> : <UserLucide className="h-4 w-4 mr-2" />}
              {isEditing ? "Simpan" : "Tambah"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const THEME_OPTIONS: { value: Theme; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: "light", label: "Terang", desc: "Selalu terang", icon: <Sun className="h-4 w-4" /> },
  { value: "dark", label: "Gelap", desc: "Selalu gelap", icon: <Moon className="h-4 w-4" /> },
  { value: "system", label: "Sistem", desc: "Ikuti perangkat", icon: <Monitor className="h-4 w-4" /> },
];

export function Settings() {
  const { user: authUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const [userList, setUserList] = useState<User[]>(() => {
    const stored = localStorage.getItem("tm_users");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return mockUsers;
      }
    }
    localStorage.setItem("tm_users", JSON.stringify(mockUsers));
    return mockUsers;
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const saveUsers = (next: User[]) => {
    setUserList(next);
    localStorage.setItem("tm_users", JSON.stringify(next));
  };

  const openAddDialog = () => {
    setEditingUser(null);
    setDialogOpen(true);
  };

  const openEditDialog = (u: User) => {
    setEditingUser(u);
    setDialogOpen(true);
  };

  const handleSubmit = (data: Partial<User> & { password?: string }) => {
    if (editingUser) {
      // Edit existing
      saveUsers(
        userList.map((u) =>
          u.id === editingUser.id
            ? { ...u, ...data, password: data.password ?? u.password }
            : u
        )
      );
    } else {
      // Add new
      const newUser: User = {
        id: `u-${Date.now()}`,
        username: data.username!,
        name: data.name!,
        role: data.role ?? "member",
        password: data.password ?? "password123",
      };
      saveUsers([...userList, newUser]);
    }
    setDialogOpen(false);
  };

  const confirmDelete = (id: string) => {
    if (id === authUser?.id) return; // Prevent self-delete
    setDeleteTarget(id);
  };

  const executeDelete = () => {
    if (deleteTarget) {
      saveUsers(userList.filter((u) => u.id !== deleteTarget));
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Kelola user dan pengaturan sistem</p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-2" /> Tambah User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tampilan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-3">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTheme(opt.value)}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50",
                  theme === opt.value && "border-primary bg-muted/50 ring-1 ring-primary"
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                  {opt.icon}
                </span>
                <span>
                  <span className="block text-sm font-medium">{opt.label}</span>
                  <span className="block text-xs text-muted-foreground">{opt.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manajemen User</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userList.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">{initials(u.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.id}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">@{u.username}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.role === "admin" ? "default" : u.role === "leader" ? "secondary" : "outline"}>
                      {u.role === "admin" && <Shield className="h-3 w-3 mr-1" />}
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {u.id !== authUser?.id && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(u)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {u.id !== authUser?.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => confirmDelete(u.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <UserFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSubmit={handleSubmit} initialData={editingUser} />
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus User</DialogTitle>
            <DialogDescription>Yakin ingin menghapus user ini? Tindakan ini tidak bisa dibatalkan.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Batal</Button>
            <Button variant="destructive" onClick={executeDelete}>Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}