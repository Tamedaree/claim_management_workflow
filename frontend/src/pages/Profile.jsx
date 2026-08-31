import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import api from "@/api/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  User,
  Mail,
  Phone,
  Building2,
  MapPin,
  Briefcase,
  Save,
  Loader2,
  Camera,
} from "lucide-react";
import { ROLE_LABELS } from "@/lib/roleConfig";

const API_ORIGIN = "http://localhost:5000";

function getAvatarUrl(pathOrUrl) {
  if (!pathOrUrl) return null;

  if (
    pathOrUrl.startsWith("http://") ||
    pathOrUrl.startsWith("https://") ||
    pathOrUrl.startsWith("blob:")
  ) {
    return pathOrUrl;
  }

  return `${API_ORIGIN}${pathOrUrl}`;
}

export default function Profile() {
  const { user: contextUser } = useOutletContext();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [staffName, setStaffName] = useState(null);
  const [localPreview, setLocalPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    phone: "",
    work_location: "",
  });

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      setLoading(true);
      try {
        const res = await api.get("/auth/me");
        const u = res.data.user || res.data.data || res.data;
        if (cancelled) return;

        setUser(u);
        setForm({
          phone: u.phone || "",
          work_location: u.work_location || "",
        });
      } catch {
        if (cancelled) return;
        if (contextUser) {
          setUser(contextUser);
          setForm({
            phone: contextUser.phone || "",
            work_location: contextUser.work_location || "",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [contextUser]);

  // The User (login) table has no name field — the real name lives on
  // StaffMember, matched by email.
  useEffect(() => {
    if (!user?.email) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await api.get(
          `/staff?email=${encodeURIComponent(user.email)}`,
        );
        const staff = res.data?.data || [];
        if (!cancelled && staff.length > 0) {
          const s = staff[0];
          const fullName = [s.first_name, s.middle_name, s.last_name]
            .filter(Boolean)
            .join(" ");
          if (fullName) setStaffName(fullName);
        }
      } catch (error) {
        console.error("Failed to load staff name:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.put("/auth/profile", form);
      const updated = res.data.user || res.data.data || res.data;
      setUser((prev) => ({ ...prev, ...updated }));
      localStorage.setItem(
        "user",
        JSON.stringify({ ...(user || {}), ...updated }),
      );
      toast.success("Profile updated successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file.");
      event.target.value = "";
      return;
    }

    const MAX_FILE_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Profile photo must be less than 2MB.");
      event.target.value = "";
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setLocalPreview(previewUrl);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("photo", file);

      const response = await api.post("/auth/profile-photo", formData);
      const updatedUser = response.data?.user || response.data?.data;
      const imagePath = updatedUser?.profile_image_url;

      if (!imagePath) {
        throw new Error("Server did not return the profile image URL.");
      }

      const fullImageUrl = getAvatarUrl(imagePath);

      const cachedUser = JSON.parse(localStorage.getItem("user") || "{}");
      const newUser = {
        ...cachedUser,
        ...updatedUser,
        profile_image_url: imagePath,
      };
      localStorage.setItem("user", JSON.stringify(newUser));

      setUser((prev) => ({ ...prev, profile_image_url: imagePath }));

      URL.revokeObjectURL(previewUrl);
      setLocalPreview(fullImageUrl);

      toast.success("Profile photo updated successfully.");
    } catch (error) {
      console.error("Profile photo upload error:", error);
      URL.revokeObjectURL(previewUrl);
      setLocalPreview(null);

      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Profile photo upload failed.";
      toast.error(message);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const displayName = staffName || user?.email || "User";
  const roleLabel = ROLE_LABELS[user?.role] || user?.role || "—";
  const departmentLabel = user?.department
    ? user.department.replace(/_/g, " ")
    : "—";
  const avatarUrl =
    localPreview || getAvatarUrl(user?.profile_image_url) || null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account information
        </p>
      </div>

      {/* Profile header */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="w-16 h-16 rounded-2xl object-cover border border-border"
                  onError={(event) => {
                    console.error("Failed to load profile image:", avatarUrl);
                    event.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold">
                  {(displayName || "U").charAt(0).toUpperCase()}
                </div>
              )}

              <label
                htmlFor="profile-photo-input"
                className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-background border shadow flex items-center justify-center hover:bg-muted transition-colors cursor-pointer"
                title="Upload profile photo"
              >
                {uploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5" />
                )}
              </label>
              <input
                id="profile-photo-input"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                disabled={uploading}
                onChange={handlePhotoChange}
              />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-semibold truncate">{displayName}</p>
              <p className="text-sm text-muted-foreground truncate">
                {user?.email}
              </p>
              <Badge variant="secondary" className="mt-2 text-[11px]">
                {roleLabel}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account info (read-only, set by admin) */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4" /> Account
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            These details were set by your administrator and can't be changed
            here.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <div className="flex items-center gap-2 h-11 px-3 rounded-md border bg-muted/40 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="truncate">{user?.email || "—"}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Role</Label>
            <div className="flex items-center gap-2 h-11 px-3 rounded-md border bg-muted/40 text-sm">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span>{roleLabel}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Department</Label>
            <div className="flex items-center gap-2 h-11 px-3 rounded-md border bg-muted/40 text-sm">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span>{departmentLabel}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Position Title
            </Label>
            <div className="flex items-center gap-2 h-11 px-3 rounded-md border bg-muted/40 text-sm">
              <Briefcase className="w-4 h-4 text-muted-foreground" />
              <span className="truncate">{user?.position_title || "—"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Editable details */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Personal details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  className="pl-10"
                  placeholder="09xxxxxxxx"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="work_location">Work location</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="work_location"
                  value={form.work_location}
                  onChange={(e) => updateField("work_location", e.target.value)}
                  className="pl-10"
                  placeholder="Head Office"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save changes
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
