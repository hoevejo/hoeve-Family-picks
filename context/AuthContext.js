"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth } from "../lib/firebaseConfig";
import { db } from "../lib/firebaseConfig";

// Auth context structure
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
    let unsubscribe;

    const initializeAuth = async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);

        unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
          if (currentUser) {
            try {
              const userRef = doc(db, "users", currentUser.uid);
              const userSnap = await getDoc(userRef);

              if (userSnap.exists()) {
                const firestoreUser = userSnap.data();

                const mergedUser = {
                  ...currentUser,
                  ...firestoreUser,
                  notificationsEnabled:
                    firestoreUser.notificationsEnabled ?? false,
                };

                setUser(mergedUser);
                setIsAdmin(firestoreUser.isAdmin === true);

                const theme = firestoreUser.theme || "theme-blue-light";
                document.body.className = theme;
                localStorage.setItem("theme", theme);
              } else {
                console.warn("User document not found.");
                setUser(currentUser);
                setIsAdmin(false);
              }
            } catch (error) {
              console.error("Failed to load user data:", error);
              setUser(currentUser);
              setIsAdmin(false);
            }
          } else {
            setUser(null);
            setIsAdmin(false);
          }

          setLoading(false);
        });
      } catch (err) {
        console.error("Persistence error:", err);
        setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      if (unsubscribe) unsubscribe();
    };
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

export const useAuth = () => useContext(AuthContext);
