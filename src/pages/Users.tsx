import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2, Edit, Shield, Save, User as UserLucide, MoveLeft } from "lucide-react";
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
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/contexts/AuthContext";
import { isUsernameTaken, defaultUsername } from "@/lib/api/profiles";
import { listRoles, type Role } from "@/lib/api/roles";
import { createUserAsAdmin, updateUserAsAdmin, deleteUserAsAdmin } from "@/lib/api/auth";
import { useUsers } from "@/hooks/useSupabaseLists";
import type { User, UserRole } from "@/types";
import { initials } from "@/lib/format";

function UserFormDialog({
  open,
  onClose,
  onSubmit,
  initialData,
  currentUserId,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<User> & { password?: string }) => Promise<void> | void;
  initialData?: User | null;
  currentUserId?: string;
}) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [username, setUsername] = useState(initialData?.username ?? "");
  const [role, setRole] = useState<UserRole>(initialData?.role ?? "Member");
  const [password, setPassword] = useState("");
  const [usernameTaken, setUsernameTaken] = useState(false);
  const [roles, setRoles] = useState<Role[]>([
    { name: "admin" },
    { name: "Team Leader" },
    { name: "Foreman" },
    { name: "Member" },
  ]);
  const isEditing = !!initialData;

  useEffect(() => {
    if (!open) return;
    listRoles().then(setRoles).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setName(initialData?.name ?? "");
    setUsername(initialData?.username ?? "");
    setRole(initialData?.role ?? "Member");
    setPassword("");
    setUsernameTaken(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const u = username.trim();
    if (!u) {
      setUsernameTaken(false);
      return;
    }
    let active = true;
    const handle = setTimeout(() => {
      isUsernameTaken(u, initialData?.id ?? currentUserId)
        .then((taken) => {
          if (active) setUsernameTaken(taken);
        })
        .catch(() => {
          if (active) setUsernameTaken(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [username, initialData?.id, currentUserId]);

  const taken = usernameTaken;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (taken) return;
    await onSubmit({ name, username, role, password: password || undefined });
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (!isEditing) setUsername(defaultUsername(value));
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
            <Input id="su-name" value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="cth: Operator C" autoFocus />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="su-username">Username</Label>
            <Input id="su-username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="cth: operator_c" maxLength={20} />
            {taken && <p className="text-xs text-destructive">Username sudah dipakai user lain.</p>}
          </div>
          <div className="grid gap-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.name} value={r.name}>
                    {r.name.charAt(0).toUpperCase() + r.name.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="su-password">Password {isEditing ? "(kosongkan jika tidak diubah)" : ""}</Label>
            <Input id="su-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isEditing ? "Biarkan kosong untuk tidak mengubah" : "password123"} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!name.trim() || !username.trim() || taken || (!isEditing && !password)}>
              {isEditing ? <Save className="h-4 w-4 mr-2" /> : <UserLucide className="h-4 w-4 mr-2" />}
              {isEditing ? "Simpan" : "Tambah"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Users() {
  const { user: authUser } = useAuth();
  const { data: userList, reload } = useUsers();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  if (authUser?.role !== "admin") {
    return (
      <div className="flex flex-col items-start gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/"><MoveLeft className="h-4 w-4" /> Kembali ke Dashboard</Link>
        </Button>
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm text-muted-foreground">
          <Shield className="h-4 w-4 shrink-0" />
          Halaman ini hanya dapat diakses oleh administrator.
        </div>
      </div>
    );
  }

  const openAddDialog = () => {
    setEditingUser(null);
    setDialogOpen(true);
  };

  const openEditDialog = (u: User) => {
    setEditingUser(u);
    setDialogOpen(true);
  };

  const handleSubmit = async (data: Partial<User> & { password?: string }) => {
    if (editingUser) {
      await updateUserAsAdmin(editingUser.id, {
        name: data.name,
        username: data.username?.toLowerCase(),
        role: data.role,
        password: data.password,
      });
    } else {
      await createUserAsAdmin({
        name: data.name!,
        username: data.username!.toLowerCase(),
        password: data.password!,
        role: data.role ?? "Member",
      });
    }
    setDialogOpen(false);
    reload();
  };

  const confirmDelete = (id: string) => {
    if (id === authUser?.id) return; // Prevent self-delete
    setDeleteTarget(id);
  };

  const executeDelete = async () => {
    if (deleteTarget) {
      await deleteUserAsAdmin(deleteTarget);
      setDeleteTarget(null);
      reload();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manajemen User"
        description="Kelola user, role, dan akses — khusus administrator"
        actions={
          <Button onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" /> Tambah User
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Daftar User ({userList.length})</CardTitle>
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
                    <Badge variant={u.role === "admin" ? "default" : u.role === "Team Leader" || u.role === "Foreman" ? "secondary" : "outline"}>
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

      <UserFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        initialData={editingUser}
        currentUserId={authUser?.id}
      />

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
