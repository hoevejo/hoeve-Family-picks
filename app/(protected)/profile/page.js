"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebaseConfig";
import Image from "next/image";
import toast from "react-hot-toast";
import { FaPencilAlt } from "react-icons/fa";
import Modal from "../../components/Modal";
import avatarOptions from "@/data/avatarList.js";

const themes = [
  { name: "Blue (Light)", value: "theme-blue-light" },
  { name: "Blue (Dark)", value: "theme-blue-dark" },
  { name: "Sunset (Light)", value: "theme-orange-light" },
  { name: "Sunset (Dark)", value: "theme-orange-dark" },
  { name: "Forest (Light)", value: "theme-green-light" },
  { name: "Forest (Dark)", value: "theme-green-dark" },
  { name: "Lavender (Light)", value: "theme-purple-light" },
  { name: "Lavender (Dark)", value: "theme-purple-dark" },
  { name: "Gold (Light)", value: "theme-gold-light" },
  { name: "Gold (Dark)", value: "theme-gold-dark" },
];

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
      const theme =
        localStorage.getItem("theme") || user.theme || "theme-blue-light";
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
      document.body.className = theme;
      localStorage.setItem("theme", theme);
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));

    if (name === "theme") {
      document.body.className = value;
      localStorage.setItem("theme", value);
      handleSave("theme", value);
    }
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
        await updateDoc(doc(db, "leaderboard", user.uid), {
          fullName,
          firstName,
          lastName,
        });

        localStorage.setItem("firstName", firstName);
        localStorage.setItem("lastName", lastName);
        localStorage.setItem("fullName", fullName);
      } else if (field === "profilePicture") {
        const finalUrl =
          value === "dicebear-default"
            ? `https://api.dicebear.com/7.x/initials/png?seed=${form.firstName}%20${form.lastName}`
            : value;

        updates = { profilePicture: finalUrl };
        await updateDoc(doc(db, "leaderboard", user.uid), {
          profilePicture: finalUrl,
        });
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
    <div className="px-4 py-6 bg-[var(--bg-color)] text-[var(--text-color)] transition-colors flex justify-center">
      <div className="w-full max-w-md bg-[var(--card-color)] border border-[var(--border-color)] rounded-xl shadow-lg p-6 space-y-6">
        <h1 className="text-2xl font-bold text-center">Your Profile</h1>

        <div className="flex justify-center relative">
          <Image
            src={form.profilePicture || "/default-avatar.png"}
            alt="Profile"
            width={80}
            height={80}
            className="rounded-full border border-[var(--border-color)]"
          />
          <FaPencilAlt
            onClick={() => setShowAvatarModal(true)}
            className="absolute bottom-0 right-[30%] text-white bg-[var(--accent-color)] rounded-full p-1 cursor-pointer"
          />
        </div>

        <div className="space-y-4">
          <div>
            <label className="block font-medium">Email</label>
            <p className="bg-[var(--input-bg)] text-[var(--input-text)] rounded px-3 py-2">
              {user.email}
            </p>
          </div>

          <div>
            <label className="block font-medium flex justify-between items-center">
              Name
              <FaPencilAlt
                className="text-sm cursor-pointer"
                onClick={() => setEditingField("name")}
              />
            </label>
            {editingField === "name" ? (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    name="firstName"
                    value={form.firstName}
                    onChange={handleChange}
                    placeholder="First Name"
                    className="w-1/2 p-2 border rounded-lg bg-[var(--input-bg)] text-[var(--input-text)]"
                  />
                  <input
                    name="lastName"
                    value={form.lastName}
                    onChange={handleChange}
                    placeholder="Last Name"
                    className="w-1/2 p-2 border rounded-lg bg-[var(--input-bg)] text-[var(--input-text)]"
                  />
                </div>
                <button
                  onClick={() => handleSave("name")}
                  className="px-3 py-1 bg-[var(--accent-color)] text-white rounded-lg"
                >
                  Save
                </button>
              </div>
            ) : (
              <p className="bg-[var(--input-bg)] text-[var(--input-text)] rounded px-3 py-2">
                {form.firstName} {form.lastName}
              </p>
            )}
          </div>

          <div>
            <label className="block font-medium">Theme</label>
            <select
              name="theme"
              value={form.theme}
              onChange={handleChange}
              className="w-full p-2 border rounded-lg bg-[var(--input-bg)] text-[var(--input-text)]"
            >
              {themes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-4 text-center">
          <button onClick={logout} className="text-red-500 hover:underline">
            Log Out
          </button>
        </div>
      </div>

      {showAvatarModal && (
        <Modal onClose={() => setShowAvatarModal(false)}>
          <div className="space-y-4 p-4">
            <h2 className="text-xl font-bold mb-2">Select a New Avatar</h2>

            {avatarCategory ? (
              <>
                <button
                  className="text-sm text-blue-500 underline mb-2"
                  onClick={() => {
                    setAvatarCategory(null);
                    setSelectedAvatar(null);
                  }}
                >
                  ← Back to Categories
                </button>

                <div className="grid grid-cols-3 gap-4">
                  {filteredAvatars.map((option) => (
                    <Image
                      key={option.value}
                      src={option.value}
                      alt={option.label}
                      width={64}
                      height={64}
                      onClick={() => setSelectedAvatar(option.value)}
                      className={`rounded-full border-2 cursor-pointer ${
                        selectedAvatar === option.value
                          ? "border-[var(--accent-color)]"
                          : "border-transparent hover:border-[var(--accent-color)]"
                      }`}
                    />
                  ))}
                </div>

                <div className="pt-4 text-right">
                  <button
                    onClick={() =>
                      selectedAvatar &&
                      handleSave("profilePicture", selectedAvatar)
                    }
                    className="px-4 py-2 bg-[var(--accent-color)] text-white rounded"
                  >
                    Save
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <Image
                  src={dicebearUrl}
                  alt="Default Avatar"
                  width={64}
                  height={64}
                  onClick={() =>
                    handleSave("profilePicture", "dicebear-default")
                  }
                  className="rounded-full border-2 border-transparent hover:border-[var(--accent-color)] cursor-pointer mx-auto"
                />

                <div className="flex justify-around mt-4">
                  {["Animals", "Football", "Misc"].map((category) => (
                    <button
                      key={category}
                      onClick={() => setAvatarCategory(category)}
                      className="px-4 py-2 border rounded bg-[var(--accent-color)] text-white"
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
