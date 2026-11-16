"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { doc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebaseConfig";
import Image from "next/image";
import toast from "react-hot-toast";
import { FaPencilAlt } from "react-icons/fa";
import Modal from "../../components/Modal";
import avatarOptions from "@/data/avatarList.js";
import {
  applyTheme,
  normalizeTheme,
  THEME_OPTIONS,
  THEME_STORAGE_KEY,
} from "../../lib/theme";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    profilePicture: "",
    theme: "",
  });

  const [editingField, setEditingField] = useState(null);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarCategory, setAvatarCategory] = useState(null);
  const [selectedAvatar, setSelectedAvatar] = useState(null);

  useEffect(() => {
    if (user) {
      const theme = normalizeTheme(
        localStorage.getItem(THEME_STORAGE_KEY) || user.theme,
      );
      const firstName =
        localStorage.getItem("firstName") || user.firstName || "";
      const lastName = localStorage.getItem("lastName") || user.lastName || "";
      const profilePicture = user.profilePicture || "";

      setForm({
        firstName,
        lastName,
        profilePicture,
        theme,
      });
      applyTheme(theme);
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleThemeChange = (value) => {
    setForm((prev) => ({ ...prev, theme: value }));
    applyTheme(value);
    handleSave("theme", value);
  };

  const handleSave = async (field, value = null) => {
    if (!user) return;
    const toastId = toast.loading("Saving changes...");

    try {
      let updates = {};
      if (field === "name") {
        const firstName = form.firstName.trim();
        const lastName = form.lastName.trim();
        const fullName = `${firstName} ${lastName}`.trim();
        updates = {
          displayName: fullName,
          fullName,
          firstName,
          lastName,
        };
        // setDoc(merge), not updateDoc -- doesn't assume the doc exists.
        await setDoc(
          doc(db, "publicProfiles", user.uid),
          { fullName, firstName, lastName },
          { merge: true },
        );

        localStorage.setItem("firstName", firstName);
        localStorage.setItem("lastName", lastName);
        localStorage.setItem("fullName", fullName);
      } else if (field === "profilePicture") {
        const finalUrl =
          value === "dicebear-default"
            ? `https://api.dicebear.com/7.x/initials/png?seed=${form.firstName}%20${form.lastName}`
            : value;

        updates = { profilePicture: finalUrl };
        await setDoc(
          doc(db, "publicProfiles", user.uid),
          { profilePicture: finalUrl },
          { merge: true },
        );
        setForm((prev) => ({ ...prev, profilePicture: finalUrl }));
      } else if (field === "theme") {
        updates = { theme: value };
      }

      await updateDoc(doc(db, "users", user.uid), updates);
      toast.success("Profile updated!", { id: toastId });
      setEditingField(null);
      setShowAvatarModal(false);
      setAvatarCategory(null);
      setSelectedAvatar(null);
    } catch (error) {
      toast.error("Failed to update profile.", { id: toastId });
    }
  };

  if (!user) return null;

  // Filter the avatars by the selected category and get the avatars
  const filteredAvatars = avatarCategory
    ? avatarOptions
        .filter((opt) => opt.category === avatarCategory)
        .flatMap((opt) => opt.avatars) // Extract the avatars array
    : [];

  const dicebearUrl = `https://api.dicebear.com/7.x/initials/png?seed=${form.firstName}%20${form.lastName}`;

  return (
    <div className="max-w-md mx-auto py-6 space-y-4">
      <h1 className="text-4xl uppercase italic leading-none">Profile</h1>

      {/* Avatar + identity */}
      <div className="rounded-2xl bg-accent-gradient text-white shadow-card p-6 flex flex-col items-center text-center">
        <div className="relative">
          <Image
            src={form.profilePicture || "/default-avatar.png"}
            alt="Profile"
            width={96}
            height={96}
            className="h-24 w-24 rounded-full object-cover ring-4 ring-white/40"
          />
          <button
            type="button"
            aria-label="Change avatar"
            onClick={() => setShowAvatarModal(true)}
            className="absolute bottom-0 right-0 grid place-items-center h-8 w-8 rounded-full bg-white text-accent shadow-card hover:scale-105 transition-transform"
          >
            <FaPencilAlt className="text-xs" />
          </button>
        </div>
        <p className="mt-3 font-display text-3xl font-extrabold uppercase leading-none">
          {form.firstName} {form.lastName}
        </p>
        <p className="mt-1 text-sm text-white">{user.email}</p>
      </div>

      {/* Name */}
      <div className="rounded-2xl bg-surface border border-line shadow-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className={sectionLabel}>Name</span>
          {editingField !== "name" && (
            <button
              type="button"
              aria-label="Edit name"
              onClick={() => setEditingField("name")}
              className="grid place-items-center h-8 w-8 rounded-full text-muted hover:text-fg hover:bg-surface-2 transition-colors"
            >
              <FaPencilAlt className="text-xs" />
            </button>
          )}
        </div>
        {editingField === "name" ? (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                placeholder="First Name"
                className={`w-1/2 ${field}`}
              />
              <input
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                placeholder="Last Name"
                className={`w-1/2 ${field}`}
              />
            </div>
            <button
              onClick={() => handleSave("name")}
              className="py-2.5 rounded-xl bg-accent text-white font-semibold hover:bg-accent-hover transition-colors"
            >
              Save
            </button>
          </div>
        ) : (
          <p className="font-semibold">
            {form.firstName} {form.lastName}
          </p>
        )}
      </div>

      {/* Appearance */}
      <div className="rounded-2xl bg-surface border border-line shadow-card p-4">
        <span className={`block mb-2 ${sectionLabel}`}>Theme</span>
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-surface-2 border border-line">
          {THEME_OPTIONS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => handleThemeChange(t.value)}
              className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
                form.theme === t.value
                  ? "bg-accent text-white shadow-card"
                  : "text-muted hover:text-fg"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={logout}
        className="w-full py-3 rounded-xl border border-danger/40 text-danger font-semibold hover:bg-danger/10 transition-colors"
      >
        Log Out
      </button>

      {showAvatarModal && (
        <Modal onClose={() => setShowAvatarModal(false)}>
          <div className="space-y-4">
            <h2 className="text-2xl uppercase">Choose an Avatar</h2>

            {avatarCategory ? (
              <>
                <button
                  className="text-sm font-semibold text-accent-text hover:underline"
                  onClick={() => {
                    setAvatarCategory(null);
                    setSelectedAvatar(null);
                  }}
                >
                  ← Back to Categories
                </button>

                <div className="grid grid-cols-3 gap-4 justify-items-center">
                  {filteredAvatars.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selectedAvatar === option.value}
                      onClick={() => setSelectedAvatar(option.value)}
                      className={`rounded-full ring-offset-2 ring-offset-surface transition ${
                        selectedAvatar === option.value
                          ? "ring-4 ring-accent"
                          : "hover:ring-2 hover:ring-line"
                      }`}
                    >
                      <Image
                        src={option.value}
                        alt={option.label}
                        width={64}
                        height={64}
                        className="h-16 w-16 rounded-full object-cover"
                      />
                    </button>
                  ))}
                </div>

                <button
                  onClick={() =>
                    selectedAvatar &&
                    handleSave("profilePicture", selectedAvatar)
                  }
                  disabled={!selectedAvatar}
                  className="w-full py-2.5 rounded-xl bg-accent text-white font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  Save
                </button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleSave("profilePicture", "dicebear-default")
                    }
                    className="rounded-full hover:ring-4 hover:ring-accent ring-offset-2 ring-offset-surface transition"
                  >
                    <Image
                      src={dicebearUrl}
                      alt="Default Avatar"
                      width={64}
                      height={64}
                      className="h-16 w-16 rounded-full"
                    />
                  </button>
                  <span className="text-xs text-muted">Use your initials</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {["Animals", "Football", "Misc"].map((category) => (
                    <button
                      key={category}
                      onClick={() => setAvatarCategory(category)}
                      className="py-2.5 rounded-xl bg-surface-2 border border-line font-semibold hover:bg-accent/10 hover:border-accent transition-colors"
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

const sectionLabel = "text-xs font-bold uppercase tracking-widest text-muted";
const field =
  "rounded-xl bg-surface-2 border border-line px-3 py-2.5 text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent";
