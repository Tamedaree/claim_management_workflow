import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  User,
  KeyRound,
  LogOut,
  Camera,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/api/api";
import { ROLE_LABELS } from "@/lib/roleConfig";
import { useAuth } from "@/lib/AuthContext";

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

export default function TopBar({ user }) {
  const { logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [localPreview, setLocalPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [staffName, setStaffName] = useState(null);
  const [now, setNow] = useState(new Date());

  const menuRef = useRef(null);
  const fileRef = useRef(null);

  // Live clock — ticks every second so the header date/time stays current
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formattedDate = now.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const formattedTime = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  // The User (login) table has no name field — the real name lives on
  // StaffMember, matched by email. Fetch it directly so the name row
  // can never accidentally fall back to the role.
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

  const displayName = staffName || user?.email || "User";

  const roleLabel = ROLE_LABELS[user?.role] || user?.role || "";

  const initial = displayName ? displayName.charAt(0).toUpperCase() : "U";

  /*
   * Priority:
   * 1. Local preview while uploading
   * 2. Saved profile image from user
   * 3. Initial
   */
  const avatarUrl =
    localPreview || getAvatarUrl(user?.profile_image_url) || null;

  // ============================================================
  // Load unread notifications
  // ============================================================

  useEffect(() => {
    if (!user?.id) return;

    const loadUnreadNotifications = async () => {
      try {
        const res = await api.get(
          `/notifications?user_id=${user.id}&is_read=false`,
        );

        const data =
          res.data?.data || res.data?.notifications || res.data || [];

        setUnreadCount(Array.isArray(data) ? data.length : 0);
      } catch (error) {
        console.error("Failed to load notifications:", error);
      }
    };

    loadUnreadNotifications();
  }, [user?.id]);

  // ============================================================
  // Close dropdown when clicking outside
  // ============================================================

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  // ============================================================
  // Logout
  // ============================================================

  const handleLogout = () => {
    logout();
  };

  // ============================================================
  // Profile photo upload
  // ============================================================

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

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

  return (
    <header
      className="
        h-16
        border-b border-border
        bg-card
        flex items-center justify-between
        px-6
        sticky top-0
        z-40
      "
    >
      <div>
        <h2 className="text-sm font-medium text-muted-foreground">
          Ethiopia Insurance Corporation
        </h2>
        <p className="text-sm font-medium text-muted-foreground bold">
          Your Reliable Partner
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex flex-col items-end mr-1 leading-tight">
          <span className="text-xs font-medium text-foreground tabular-nums">
            {formattedTime}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {formattedDate}
          </span>
        </div>

        <Link
          to="/notifications"
          className="
            relative
            p-2
            rounded-lg
            hover:bg-muted
            transition-colors
          "
        >
          <Bell className="w-5 h-5 text-muted-foreground" />

          {unreadCount > 0 && (
            <span
              className="
                absolute
                -top-0.5
                -right-0.5
                w-5
                h-5
                bg-red-500
                text-white
                text-[10px]
                font-bold
                rounded-full
                flex items-center justify-center
              "
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="
              flex
              items-center
              gap-2
              rounded-lg
              px-2
              py-1.5
              hover:bg-muted
              transition-colors
            "
          >
            <div className="relative">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="
                    w-8
                    h-8
                    rounded-full
                    object-cover
                    border
                    border-border
                  "
                  onError={(event) => {
                    console.error("Failed to load profile image:", avatarUrl);
                    event.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div
                  className="
                    w-8
                    h-8
                    rounded-full
                    bg-primary
                    flex items-center justify-center
                    text-primary-foreground
                    text-xs
                    font-semibold
                  "
                >
                  {initial}
                </div>
              )}
            </div>

            <div
              className="
                hidden
                md:block
                text-left
                leading-tight
              "
            >
              <p
                className="
                  text-sm
                  font-medium
                  truncate
                  max-w-[160px]
                "
              >
                {displayName}
              </p>

              <p
                className="
                  text-[11px]
                  text-muted-foreground
                  truncate
                  max-w-[160px]
                "
              >
                {roleLabel}
              </p>
            </div>

            <ChevronDown
              className="
                w-4
                h-4
                text-muted-foreground
                hidden
                sm:block
              "
            />
          </button>

          {open && (
            <div
              className="
                absolute
                right-0
                mt-2
                w-64
                rounded-xl
                border
                border-border
                bg-card
                shadow-lg
                overflow-hidden
                z-50
              "
            >
              <div
                className="
                  px-4
                  py-3
                  border-b
                  border-border
                  bg-muted/30
                "
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Profile"
                        className="
                          w-10
                          h-10
                          rounded-full
                          object-cover
                          border
                        "
                      />
                    ) : (
                      <div
                        className="
                          w-10
                          h-10
                          rounded-full
                          bg-primary
                          flex items-center justify-center
                          text-primary-foreground
                          text-sm
                          font-semibold
                        "
                      >
                        {initial}
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => fileRef.current?.click()}
                      className="
                        absolute
                        -bottom-1
                        -right-1
                        w-6
                        h-6
                        rounded-full
                        bg-background
                        border
                        shadow
                        flex items-center justify-center
                        hover:bg-muted
                        disabled:opacity-50
                      "
                      title="Upload profile photo"
                    >
                      {uploading ? (
                        <Loader2
                          className="
                            w-3
                            h-3
                            animate-spin
                          "
                        />
                      ) : (
                        <Camera className="w-3 h-3" />
                      )}
                    </button>

                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={handlePhotoChange}
                    />
                  </div>

                  <div className="min-w-0">
                    <p
                      className="
                        text-sm
                        font-semibold
                        truncate
                      "
                    >
                      {displayName}
                    </p>

                    <p
                      className="
                        text-xs
                        text-muted-foreground
                        truncate
                      "
                    >
                      {user?.email}
                    </p>

                    <p
                      className="
                        text-[11px]
                        text-primary
                        font-medium
                        mt-0.5
                      "
                    >
                      {roleLabel}
                    </p>
                  </div>
                </div>
              </div>

              <div className="py-1">
                <Link
                  to="/profile"
                  onClick={() => setOpen(false)}
                  className="
                    flex
                    items-center
                    gap-2
                    px-4
                    py-2.5
                    text-sm
                    hover:bg-muted
                    transition-colors
                  "
                >
                  <User
                    className="
                      w-4
                      h-4
                      text-muted-foreground
                    "
                  />
                  My Profile
                </Link>

                <Link
                  to="/change-password"
                  onClick={() => setOpen(false)}
                  className="
                    flex
                    items-center
                    gap-2
                    px-4
                    py-2.5
                    text-sm
                    hover:bg-muted
                    transition-colors
                  "
                >
                  <KeyRound
                    className="
                      w-4
                      h-4
                      text-muted-foreground
                    "
                  />
                  Change Password
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="
                    w-full
                    flex
                    items-center
                    gap-2
                    px-4
                    py-2.5
                    text-sm
                    text-red-600
                    hover:bg-red-50
                    transition-colors
                  "
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
