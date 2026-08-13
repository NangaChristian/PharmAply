import React, { createContext, useContext, useState, useEffect } from "react";
import toast from "react-hot-toast";

export interface CartItem {
  id: string; // product id
  name: string;
  price: number;
  imageUrl?: string;
  pharmacyId?: string;
  pharmacyName?: string;
  quantity: number;
  stock?: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: any, quantity?: number) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, delta: number) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem("pharmaply_cart");
      if (stored) {
         const parsed = JSON.parse(stored);
         return Array.isArray(parsed) ? parsed : [];
      }
      return [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("pharmaply_cart", JSON.stringify(items));
  }, [items]);

  const addToCart = (product: any, quantity = 1) => {
    const pName = product.name || product.nom_commercial || product.commercial_name || "Produit";
    const isExisting = items.some((item) => item.id === product.id);
    
    setItems((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          name: pName,
          price: parseFloat(product.price) || 0,
          imageUrl: product.imageUrl || product.image_url,
          pharmacyId: product.pharmacyId || product.pharmacy_id,
          pharmacyName: product.pharmacyName || product.pharmacy_name,
          quantity: quantity,
          stock: product.stock,
        },
      ];
    });

    if (isExisting) {
      toast.success(`Quantité mise à jour pour ${pName}`);
    } else {
      toast.success(`${pName} ajouté au panier`);
    }
  };

  const removeFromCart = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item && item.quantity + delta < 1) {
        return prev.filter((i) => i.id !== id);
      }
      return prev.map((item) => {
        if (item.id === id) {
          return { ...item, quantity: item.quantity + delta };
        }
        return item;
      });
    });
  };

  const clearCart = () => setItems([]);

  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartCount,
        cartTotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
