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
  { name: "Light", value: "theme-light" },
  { name: "Dark", value: "theme-dark" },
  { name: "Vibrant", value: "theme-vibrant" },
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

  useEffect(() => {
    if (user) {
      const theme =
        localStorage.getItem("theme") || user.theme || "theme-light";
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
      document.body.classList.remove(
        "theme-light",
        "theme-dark",
        "theme-vibrant"
      );
      document.body.classList.add(theme);
      localStorage.setItem("theme", theme);
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));

    if (name === "theme") {
      document.body.classList.remove(
        "theme-light",
        "theme-dark",
        "theme-vibrant"
      );
      document.body.classList.add(value);
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
    } catch (error) {
      toast.error("Failed to update profile.", { id: toastId });
    }
  };

  if (!user) return null;

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
            className="absolute bottom-0 right-[30%] text-white bg-blue-600 rounded-full p-1 cursor-pointer"
          />
        </div>

        <div className="space-y-4">
          <div>
            <label className="block font-medium">Email</label>
            <p className="bg-gray-100 dark:bg-gray-800 rounded px-3 py-2">
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
                    className="w-1/2 p-2 border rounded-lg"
                  />
                  <input
                    name="lastName"
                    value={form.lastName}
                    onChange={handleChange}
                    placeholder="Last Name"
                    className="w-1/2 p-2 border rounded-lg"
                  />
                </div>
                <button
                  onClick={() => handleSave("name")}
                  className="px-3 bg-blue-600 text-white rounded-lg"
                >
                  Save
                </button>
              </div>
            ) : (
              <p className="bg-gray-100 dark:bg-gray-800 rounded px-3 py-2">
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
              className="w-full p-2 border rounded-lg"
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
            <h2 className="text-xl font-bold">Select a New Avatar</h2>
            <div className="grid grid-cols-3 gap-4">
              {avatarOptions.map((option) => {
                const isDicebear = option.value === "dicebear-default";
                const avatarUrl = isDicebear
                  ? `https://api.dicebear.com/7.x/initials/png?seed=${form.firstName}%20${form.lastName}`
                  : option.value;

                return (
                  <Image
                    key={option.value}
                    src={avatarUrl}
                    alt={option.label}
                    width={64}
                    height={64}
                    onClick={() => handleSave("profilePicture", avatarUrl)}
                    className="rounded-full border-2 border-transparent hover:border-blue-500 cursor-pointer"
                  />
                );
              })}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
