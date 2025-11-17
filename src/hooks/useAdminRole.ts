import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

export const useAdminRole = (): { isAdmin: boolean; loading: boolean } => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    const checkAdminRole = async () => {
      try {
        if (!user) {
          if (!cancelled) {
            setIsAdmin(false);
            setLoading(false);
          }
          return;
        }

        // First, check custom claims (immediate access)
        const tokenResult = await user.getIdTokenResult(true);
        const role = tokenResult.claims?.role as string | undefined;
        
        if (role === "admin" || role === "organizer") {
          if (!cancelled) {
            setIsAdmin(true);
            setLoading(false);
          }
          return;
        }

        // Fallback to Firestore user_roles collection
        const roleDoc = await getDoc(doc(db, "user_roles", user.uid));
        if (roleDoc.exists()) {
          const roles = roleDoc.data().roles || [];
          if (!cancelled) {
            setIsAdmin(roles.includes("admin") || roles.includes("organizer"));
          }
        } else {
          if (!cancelled) {
            setIsAdmin(false);
          }
        }
      } catch (error) {
        console.error("Error checking admin role:", error);
        if (!cancelled) {
          setIsAdmin(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    checkAdminRole();
    
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { isAdmin, loading };
};
