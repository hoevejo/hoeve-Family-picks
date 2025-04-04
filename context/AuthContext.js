"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../lib/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebaseConfig";

// Initial context shape
const AuthContext = createContext({
  user: null,
  isAdmin: false,
  loading: true,
  logout: () => {},
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const userRef = doc(db, "users", currentUser.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const firestoreUser = userSnap.data();

            // Merge Firebase Auth user and Firestore user data
            setUser({
              ...currentUser,
              ...firestoreUser,
            });

            setIsAdmin(firestoreUser.isAdmin === true);
            const theme = firestoreUser.theme || "theme-light";
            document.documentElement.classList.remove(
              "theme-light",
              "theme-dark",
              "theme-vibrant"
            );
            document.documentElement.classList.add(theme);
          } else {
            console.warn("User document not found in Firestore.");
            setUser(currentUser);
            setIsAdmin(false);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          setUser(currentUser);
          setIsAdmin(false);
        }
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook for consuming the auth context
export const useAuth = () => {
  return useContext(AuthContext);
};
