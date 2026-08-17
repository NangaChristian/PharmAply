import React, { useState, useEffect, useRef } from "react";
import { collection, query, getDocs, doc, updateDoc, deleteDoc, onSnapshot, addDoc } from '../../lib/firebase';
import { db, handleFirestoreError, OperationType, supabase } from "../../lib/firebase";
import { Search, Plus, Edit2, Trash2, Tag, AlertCircle, Database, Upload, ArrowUpDown, Image as ImageIcon, Package, Loader2, X, Download, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import Papa from "papaparse";
import { formatCurrency } from "../../lib/utils";
import { useTranslation } from "react-i18next";
import { fetchApi } from "../../lib/apiClient";
import { useForm } from "react-hook-form";

import { seedData } from '../../seed_data';
import { getCategoryIcon } from '../../lib/icons';
import { seedProducts } from '../../lib/seed';

const produitsPatientsData = [
  {"dci": "Paracétamol", "commercial_name": "Doliprane, Efferalgan, Panadol", "dosage": "500mg", "form": "Comprimé", "is_prescription_required": false, "ux_category": "Douleurs & Fièvre"},
  {"dci": "Paracétamol", "commercial_name": "Doliprane Pédiatrique", "dosage": "2.4%", "form": "Sirop / Suspension", "is_prescription_required": false, "ux_category": "Douleurs & Fièvre"},
  {"dci": "Ibuprofène", "commercial_name": "Advil, Brufen, Nurofen", "dosage": "400mg", "form": "Comprimé", "is_prescription_required": false, "ux_category": "Douleurs & Fièvre"},
  {"dci": "Diclofénac", "commercial_name": "Voltarène, Olfen", "dosage": "50mg", "form": "Comprimé", "is_prescription_required": true, "ux_category": "Douleurs & Fièvre"},
  {"dci": "Artemether + Lumefantrine", "commercial_name": "Coartem, Lumartem, Artefan", "dosage": "20mg/120mg", "form": "Comprimé", "is_prescription_required": false, "ux_category": "Paludisme"},
  {"dci": "Oméprazole", "commercial_name": "Mopral, Zoltum, Inipomp", "dosage": "20mg", "form": "Gélule", "is_prescription_required": true, "ux_category": "Maux d'estomac & Digestion"},
  {"dci": "Diosmectite", "commercial_name": "Smecta", "dosage": "3g", "form": "Sachet", "is_prescription_required": false, "ux_category": "Maux d'estomac & Digestion"},
  {"dci": "Sels de Réhydratation Orale (SRO)", "commercial_name": "Adidiar, Orasel", "dosage": "Standard", "form": "Sachet", "is_prescription_required": false, "ux_category": "Maux d'estomac & Digestion"},
  {"dci": "Phloroglucinol", "commercial_name": "Spasfon", "dosage": "80mg", "form": "Comprimé Lyoc", "is_prescription_required": false, "ux_category": "Maux d'estomac & Digestion"},
  {"dci": "Salbutamol", "commercial_name": "Ventoline", "dosage": "100µg/dose", "form": "Aérosol / Inhalateur", "is_prescription_required": true, "ux_category": "Toux, Rhume & Asthme"},
  {"dci": "Loratadine", "commercial_name": "Clarityne", "dosage": "10mg", "form": "Comprimé", "is_prescription_required": false, "ux_category": "Allergies"},
  {"dci": "Amoxicilline", "commercial_name": "Clamoxyl, Amoxil", "dosage": "500mg", "form": "Gélule", "is_prescription_required": true, "ux_category": "Infections & Antibiotiques"},
  {"dci": "Albendazole", "commercial_name": "Zentel", "dosage": "400mg", "form": "Comprimé", "is_prescription_required": false, "ux_category": "Antiparasitaires"}
];

/*
ARCHITECTURE D'ACCÈS POUR LES PHARMACIES :

La table `produits_patients` sert de catalogue de base (référentiel global) pour toutes les pharmacies.
Les pharmacies ne dupliquent pas ces produits dans leur base, mais utilisent une table de liaison
`pharmacy_inventory` pour indiquer qu'elles possèdent un produit, son prix et sa quantité.

Table de liaison suggérée :
CREATE TABLE pharmacy_inventory (
  id uuid PRIMARY KEY,
  pharmacy_id text NOT NULL,
  produit_id uuid REFERENCES produits_patients(id),
  stock int DEFAULT 0,
  price numeric(10,2) NOT NULL
);

Requête Supabase pour lister les produits pour une pharmacie connectée :
const { data, error } = await supabase
  .from('produits_patients')
  .select(`
    *,
    pharmacy_inventory (
      stock,
      price
    )
  `)
  .eq('pharmacy_inventory.pharmacy_id', supabase.auth.user().id);

Les pharmacies peuvent ainsi consulter le catalogue global complet via :
await supabase.from('produits_patients').select('*');
et ajouter/cocher les produits correspondants dans leur 'pharmacy_inventory'.
*/

const DEFAULT_PRESET_CATEGORIES = [
  { id: "douleurs-fievre", name: "Douleurs & Fièvre" },
  { id: "rhume-toux", name: "Rhume & Toux" },
  { id: "digestion-transit", name: "Digestion & Transit" },
  { id: "vitamines-tonus", name: "Vitamines & Tonus" },
  { id: "premiers-soins", name: "Premiers Soins" },
  { id: "materiel-diagnostic", name: "Matériel & Diagnostic" },
  { id: "bebe-enfant", name: "Maternité & Bébé" },
  { id: "yeux-oreilles", name: "Yeux & Oreilles" },
  { id: "dermatologie", name: "Dermatologie" },
  { id: "hygiene-soins", name: "Hygiène & Soins" },
  { id: "cardiologie", name: "Cardiologie & Tension" },
  { id: "antibiotiques", name: "Antibiotiques" },
  { id: "general", name: "Général" }
];

export function AdminProducts() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>(DEFAULT_PRESET_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isSeeding, setIsSeeding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filters & Sorting
  const [sortBy, setSortBy] = useState<"name" | "price" | "stock" | "brand" | "category">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [rxFilter, setRxFilter] = useState<"all" | "rx" | "otc">("all");
  
  // Add/Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  type ProductFormValues = {
    name: string;
    dosage: string;
    category: string;
    brand: string;
    price: number | string;
    stock: number | string;
    imageUrl: string;
    requiresPrescription: boolean;
    description: string;
    effects: string;
    directions: string;
  };

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<ProductFormValues>();

  const fetchGlobalProducts = async () => {
     try {
        const { data, error } = await supabase.from('produits_patients').select('*');
        if (data && !error) {
           const mappedOut = data.map((d: any) => ({
               id: d.id,
               name: d.nom_commercial || d.commercial_name || d.name || '',
               description: d.dci || d.description || '',
               dosage: d.dosage || d.forme || d.form || '',
               category: d.category || d.categorie || d.ux_category || d.categorie_ux || 'Uncategorized',
               brand: d.brand || d.marque || '',
               effects: d.effects || d.effets || '',
               directions: d.directions || d.mode_emploi || '',
               requiresPrescription: d.is_prescription_required !== undefined ? d.is_prescription_required : (d.ordonnance_requise || false),
               price: d.price ? Number(d.price) : 0,
               stock: d.stock !== undefined ? Number(d.stock) : 0,
               imageUrl: d.image_url || d.imageUrl || d.image || "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80",
               isGlobal: true,
               pharmacyId: null
           }));
           setProducts(prev => {
               const withoutGlobals = prev.filter(p => !mappedOut.find(m => m.name === p.name));
               return [...mappedOut, ...withoutGlobals];
           });
        }
     } catch (err) {
         console.error('Error fetching global catalog', err);
     }
  };

  // Primary useEffect to fetch products and categories with safety timeout
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    // 1. Fetch categories
    const catQuery = query(collection(db, "categories"));
    const unsubCats = onSnapshot(catQuery, (catSnap) => {
      if (!isMounted) return;
      const cats = catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCategories(cats);
    }, (err) => {
      console.warn("Failed to listen to categories in Firestore", err);
    });

    // 2. Fetch products from Firestore with onSnapshot
    const prodQuery = query(collection(db, "products"));
    const unsubProducts = onSnapshot(prodQuery, (snapshot) => {
      if (!isMounted) return;
      const fsProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(fsProducts);
      setLoading(false);
      // Fetch global reference products asynchronously
      fetchGlobalProducts().catch(() => {});
    }, (error) => {
      console.error("Error fetching Firestore products:", error);
      if (isMounted) {
        setLoading(false);
        fetchGlobalProducts().catch(() => {});
      }
    });

    // Fallback safety timeout so loading state never hangs indefinitely
    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 4000);

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      unsubCats();
      unsubProducts();
    };
  }, []);

  const handleSeed = async () => {
     if (!window.confirm("Êtes-vous sûr de vouloir insérer les produits de base ? Les entrées en double pourraient survenir.")) return;
     setIsSeeding(true);
     try {
        toast.loading(`Seeding ${produitsPatientsData.length} produits globaux...`, { id: 'seed' });
        
        await seedProducts(produitsPatientsData);
        
        toast.success(`${produitsPatientsData.length} Produits ajoutés au catalogue global !`, { id: 'seed' });
        
        fetchGlobalProducts();
     } catch(e: any) {
        toast.error(`Erreur: ${e.message || "Erreur lors de l'insertion."}`, { id: 'seed' });
        console.error("Erreur complète:", e);
     } finally {
        setIsSeeding(false);
     }
  };

  const [isGeneratingSingle, setIsGeneratingSingle] = useState(false);

  const handleSingleGenerateInfo = async () => {
    const productName = watch("name");
    if (!productName || !productName.trim()) {
       toast.error("Veuillez entrer le nom du produit (ex: Doliprane) avant la génération IA");
       return;
    }
    setIsGeneratingSingle(true);
    toast.loading("Génération automatique des informations par l'IA...", { id: 'single_gen' });
    try {
       const res = await fetch('/api/admin/generate-info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                products: [{
                    id: editingId || 'temp',
                    name: productName,
                    brand: watch("brand") || "",
                    dosage: watch("dosage") || "",
                    category: watch("category") || ""
                }]
            })
       });
       const data = await res.json();
       if (!res.ok || !data.success || !data.updates || data.updates.length === 0) {
           throw new Error(data.error || "Échec de la génération d'informations");
       }

       const info = data.updates[0];
       if (info.brand) setValue("brand", info.brand);
       if (info.dosage) setValue("dosage", info.dosage);
       if (info.description) setValue("description", info.description);
       if (info.effects) setValue("effects", info.effects);
       if (info.directions) setValue("directions", info.directions);

       toast.success("Marque, Dosage, Description, Effets & Mode d'emploi générés avec succès !", { id: 'single_gen' });
    } catch (err: any) {
       toast.error(`Erreur: ${err.message}`, { id: 'single_gen' });
       console.error("Single info gen error:", err);
    } finally {
       setIsGeneratingSingle(false);
    }
  };

  const handleGenerateInfo = async () => {
    if (!window.confirm("Voulez-vous auto-générer les informations manquantes (Marque, Dosage, Description, Effets, Mode d'emploi) pour tous les produits ?")) return;
    toast.loading("Génération des informations produit par l'IA...", { id: 'gen_info' });
    try {
        const missingInfoProducts = products.filter(p => !p.description || !p.effects || !p.directions || !p.brand || !p.dosage).slice(0, 50);
        
        if (missingInfoProducts.length === 0) {
            toast.success("Tous les produits possèdent déjà leurs informations !", { id: 'gen_info' });
            return;
        }

        const res = await fetch('/api/admin/generate-info', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ products: missingInfoProducts, saveToDb: true })
        });
        const data = await res.json();
        
        if (!res.ok || !data.success) throw new Error(data.error || "Failed to generate info");

        let updatedCount = 0;
        const promises = (data.updates || []).map(async (update: any) => {
           if (update.id && update.id !== 'temp') {
               try {
                   await updateDoc(doc(db, "products", update.id), {
                       brand: update.brand,
                       dosage: update.dosage,
                       description: update.description,
                       effects: update.effects,
                       directions: update.directions
                   });
               } catch (e) {
                   // Ignore if doc is only in Supabase
               }
               updatedCount++;
           }
        });
        
        await Promise.all(promises);
        toast.success(`${data.updates?.length || updatedCount} produits mis à jour par l'IA avec succès !`, { id: 'gen_info' });
        await fetchGlobalProducts();
    } catch (e: any) {
        toast.error(`Erreur: ${e.message}`, { id: 'gen_info' });
        console.error("Info gen error:", e);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = [
      ["dci", "nom_commercial", "dosage", "forme", "categorie_ux", "ordonnance_requise"],
      ["Paracétamol", "Doliprane", "500mg", "Comprimé", "Douleurs & Fièvre", "false"],
      ["Ibuprofène", "Advil", "400mg", "Comprimé", "Douleurs & Fièvre", "false"],
      ["Amoxicilline", "Clamoxyl", "500mg", "Gélule", "Infections & Antibiotiques", "true"]
    ].map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "medication_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV download template generated successfully!");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file) return;
     
     toast.loading("Parsing CSV...", { id: 'csv' });
     Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
           toast.loading(`Processing ${results.data.length} products...`, { id: 'csv' });
           
           try {
              // Strict mapping to match Supabase database expectations
              const formattedProducts = results.data.map((row: any) => ({
                 nom_commercial: row.Name || row.Brand || '',
                 dci: row.DCI || row.dci || row.description || row.Name || row.Brand || '',
                 dosage: row.Dosage || '',
                 categorie_ux: row.Category || 'Uncategorized',
                 forme: row.Form || '',
                 ordonnance_requise: String(row.RequiresPrescription).toLowerCase() === 'true'
              })).filter((item: any) => item.nom_commercial); // filter out rows without a name
              
              if (formattedProducts.length === 0) {
                 toast.error("Aucun produit valide trouvé dans le CSV. Assurez-vous que 'Name' ou 'Brand' sont fournis.", { id: 'csv' });
                 return;
              }

              await seedProducts(formattedProducts);
              toast.success(`Imported ${formattedProducts.length} products successfully!`, { id: 'csv' });
              fetchGlobalProducts(); // Refresh the global catalog list
           } catch(err: any) {
              toast.error(`Error importing products: ${err.message || 'Unknown error'}`, { id: 'csv' });
              console.error(err);
           }
           if (fileInputRef.current) fileInputRef.current.value = "";
        },
        error: (error) => {
           toast.error(`CSV Parse Error: ${error.message}`, { id: 'csv' });
        }
     });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // We mock image upload by reading as base64 data URI
    const reader = new FileReader();
    reader.onload = (event) => {
       if (event.target?.result) {
          setValue("imageUrl", event.target.result as string);
       }
    };
    reader.readAsDataURL(file);
  };

  const openAddModal = () => {
    setEditingId(null);
    reset({ name: "", dosage: "", category: "", brand: "", price: 0, stock: 0, imageUrl: "", requiresPrescription: false });
    setShowModal(true);
  };

  const openEditModal = (product: any) => {
    setEditingId(product.id);
    reset({
       name: product.name || "",
       dosage: product.dosage || "",
       category: product.category || "",
       brand: product.brand || "",
       price: product.price ? Number(product.price) : 0,
       stock: product.stock ? Number(product.stock) : 0,
       imageUrl: product.imageUrl || "",
       requiresPrescription: !!product.requiresPrescription,
       description: product.description || "",
       effects: product.effects || "",
       directions: product.directions || ""
    });
    setShowModal(true);
  };

  const onSubmit = async (data: ProductFormValues) => {
    const commercialName = data.name?.trim();
    if (!commercialName) {
       toast.error("Le nom commercial du produit est requis (Product Name)");
       return;
    }
    
    const dci = data.description?.trim() || commercialName;
    if (!dci) {
        toast.error("La description ou DCI du produit est requise");
        return;
    }

    setIsSubmitting(true);

    // Convert formData to clean payload matching database schema types
    const currentImageUrl = data.imageUrl || watch('imageUrl') || null;
    const brandVal = data.brand?.trim() || watch('brand')?.trim() || '';
    const categoryVal = data.category?.trim() || watch('category')?.trim() || 'Uncategorized';
    const priceVal = data.price !== undefined ? Number(data.price) : 0;
    const stockVal = data.stock !== undefined ? Number(data.stock) : 0;
    const effectsVal = data.effects?.trim() || watch('effects')?.trim() || '';
    const directionsVal = data.directions?.trim() || watch('directions')?.trim() || '';

    const payload = {
        id: editingId || undefined,
        nom_commercial: commercialName,
        commercial_name: commercialName,
        name: commercialName,
        dci: dci,
        description: dci,
        dosage: data.dosage?.trim() || null,
        forme: data.dosage?.trim() || null,
        form: data.dosage?.trim() || null,
        brand: brandVal,
        marque: brandVal,
        category: categoryVal,
        categorie: categoryVal,
        categorie_ux: categoryVal,
        ux_category: categoryVal,
        price: priceVal,
        stock: stockVal,
        effects: effectsVal,
        directions: directionsVal,
        ordonnance_requise: Boolean(data.requiresPrescription),
        is_prescription_required: Boolean(data.requiresPrescription),
        image_url: currentImageUrl,
        imageUrl: currentImageUrl
    };

    try {
      const response = await fetchApi('/api/admin/upsert-product', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
      });
      
      const responseData = await response.json();
      if (!response.ok || !responseData.success) {
          throw new Error(responseData.error || "Failed to save product");
      }

      // Optimistically update local React state immediately
      const savedId = editingId || responseData.data?.id || (Array.isArray(responseData.data) && responseData.data[0]?.id) || Date.now().toString();
      const updatedProduct = {
        id: savedId,
        name: commercialName,
        description: dci,
        dosage: data.dosage?.trim() || "",
        category: categoryVal,
        brand: brandVal,
        price: priceVal,
        stock: stockVal,
        imageUrl: currentImageUrl || "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80",
        requiresPrescription: Boolean(data.requiresPrescription),
        effects: effectsVal,
        directions: directionsVal,
        isGlobal: true,
        pharmacyId: null
      };

      setProducts(prev => {
        if (editingId) {
          return prev.map(p => p.id === editingId ? { ...p, ...updatedProduct } : p);
        }
        return [updatedProduct, ...prev];
      });

      // Synchronize client storage
      try {
        await setDoc(doc(db, "products", savedId), updatedProduct, { merge: true });
        await setDoc(doc(db, "produits_patients", savedId), updatedProduct, { merge: true });
      } catch (fsErr) {
        console.warn("Client store sync warning:", fsErr);
      }
      
      toast.success(editingId ? "Produit mis à jour avec succès" : "Produit créé avec succès !");
      setShowModal(false);
      setEditingId(null);
      reset({ name: "", dosage: "", category: "", brand: "", price: 0, stock: 0, imageUrl: "", requiresPrescription: false, description: "", effects: "", directions: "" });
      await fetchGlobalProducts();
    } catch (e: any) {
       toast.error(`Erreur: ${e.message}`);
       console.error("Upsert product error", e);
    } finally {
       setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer définitivement ce médicament du catalogue ?")) return;
    
    setDeletingId(id);
    // Optimistic deletion
    const previousProducts = [...products];
    setProducts(products.filter(p => p.id !== id));
    
    try {
      // 1. Delete on server API (handles both tables and admin permissions)
      const response = await fetchApi('/api/admin/delete-product', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
      });
      
      const responseData = await response.json();
      if (!response.ok || !responseData.success) {
          throw new Error(responseData.error || "Échec de la suppression");
      }

      // 2. Also cleanup from client database stores
      try {
        await deleteDoc(doc(db, "products", id));
        await deleteDoc(doc(db, "produits_patients", id));
      } catch (clientErr) {
        console.warn("Client store cleanup notice:", clientErr);
      }
      
      toast.success("Produit supprimé avec succès du catalogue !");
      await fetchGlobalProducts();
    } catch (e: any) {
       // Rollback the optimistic update
       setProducts(previousProducts);
       toast.error(`Erreur lors de la suppression: ${e.message}`);
       console.error("Delete product error", e);
    } finally {
       setDeletingId(null);
    }
  };

  const toggleSort = (field: "name" | "price" | "stock" | "brand" | "category") => {
     if (sortBy === field) {
        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
     } else {
        setSortBy(field);
        setSortOrder("asc");
     }
  };

  const clearFilters = () => {
     setSearch("");
     setRxFilter("all");
     setSortBy("name");
     setSortOrder("asc");
  };

  const filteredProducts = products.filter(p => {
    const term = search.toLowerCase();
    const matchesSearch = (p.name?.toLowerCase() || "").includes(term) ||
                          (p.brand?.toLowerCase() || "").includes(term) ||
                          (p.category?.toLowerCase() || "").includes(term);
                          
    let matchesRx = true;
    if (rxFilter === "rx") matchesRx = p.requiresPrescription === true;
    if (rxFilter === "otc") matchesRx = p.requiresPrescription !== true;

    return matchesSearch && matchesRx;
  }).sort((a, b) => {
     let comparison = 0;
     if (sortBy === "name") {
        comparison = (a.name || "").localeCompare(b.name || "");
     } else if (sortBy === "price") {
        comparison = (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0);
     } else if (sortBy === "brand") {
        comparison = (a.brand || "").localeCompare(b.brand || "");
     } else if (sortBy === "category") {
        comparison = (a.category || "").localeCompare(b.category || "");
     } else if (sortBy === "stock") {
        comparison = (parseInt(a.stock, 10) || 0) - (parseInt(b.stock, 10) || 0);
     }
     return sortOrder === "asc" ? comparison : -comparison;
  });

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement ces ${selectedIds.size} produits ?`)) return;
    
    setIsBulkDeleting(true);
    let successCount = 0;
    try {
      for (const id of selectedIds) {
        await deleteDoc(doc(db, "products", id));
        successCount++;
      }
      toast.success(`${successCount} produits supprimés avec succès`);
      setSelectedIds(new Set());
    } catch (e) {
      toast.error("Erreur lors de la suppression de certains produits");
      console.error(e);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden relative">
      <div className="bg-white dark:bg-zinc-950 px-8 pt-6 pb-6 shadow-sm z-10 border-b border-gray-200 shrink-0 flex items-center justify-between">
         <div>
             <h1 className="font-bold text-gray-900 dark:text-white text-2xl mb-1">{t('admin_products', 'Products')}</h1>
             <p className="text-gray-500 text-sm">{t('admin_products_desc', 'View and manage all medications across the platform')}</p>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
             <div className="flex items-center gap-3">
                 <div className="relative w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      placeholder={t('search_placeholder', 'Search name, brand, category...')}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-950 border border-slate-200 py-2.5 pl-12 pr-4 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition"
                    />
                 </div>
                 <select 
                    value={rxFilter}
                    onChange={(e) => setRxFilter(e.target.value as any)}
                    className="bg-white dark:bg-zinc-950 border border-slate-200 py-2.5 px-4 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition"
                 >
                    <option value="all">{t('all_products', 'All Products')}</option>
                    <option value="rx">{t('rx_only', 'Prescription Only (Rx)')}</option>
                    <option value="otc">{t('otc_only', 'Over The Counter (OTC)')}</option>
                 </select>
                 {(search || rxFilter !== "all" || sortBy !== "name") && (
                    <button 
                       onClick={clearFilters}
                       className="text-slate-500 hover:text-slate-700 text-sm font-medium underline"
                    >
                       {t('clear_filters', 'Clear Filters')}
                    </button>
                 )}
             </div>
             
             <div className="flex gap-3">
               {selectedIds.size > 0 && (
                 <button 
                    onClick={handleBulkDelete}
                    disabled={isBulkDeleting}
                    className="bg-red-50 text-red-600 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-red-100 transition flex items-center gap-2 disabled:opacity-50"
                 >
                    {isBulkDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                    {isBulkDeleting ? "Suppression en cours..." : `Supprimer sélection (${selectedIds.size})`}
                 </button>
               )}
               <input 
                  type="file" 
                  accept=".csv" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
               />
               <button 
                  onClick={handleDownloadTemplate}
                   className="bg-white dark:bg-zinc-950 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition flex items-center gap-2"
                   title="Download medication import template CSV"
                >
                   <Download size={18} className="text-teal-600" /> {t('download_template', 'Download Template')}
                </button>
                <button 
                   onClick={() => fileInputRef.current?.click()}
                  className="bg-white dark:bg-zinc-950 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition flex items-center gap-2"
               >
                  <Upload size={18} /> {t('csv_import', 'CSV Import')}
               </button>
               <button onClick={handleSeed} disabled={isSeeding} className="bg-slate-100 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-200 transition flex items-center gap-2">
                  {isSeeding ? <Loader2 size={18} className="animate-spin" /> : <Database size={18} />}
                  {isSeeding ? t('seeding', "Seeding...") : t('seed_db', "Seed Global Database")}
               </button>
               <button onClick={handleGenerateInfo} className="bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-teal-100 transition flex items-center gap-2">
                  <Sparkles size={18} className="text-teal-600 dark:text-teal-400" />
                  Générer Infos par IA
               </button>
               <button 
                  onClick={openAddModal}
                  className="bg-teal-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-teal-700 transition flex items-center gap-2"
               >
                  <Plus size={18} />
                  {t('add_global_product', 'Add Global Product')}
               </button>
             </div>
          </div>

          <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
             {loading ? (
                <div className="p-8 text-center text-slate-500">{t('loading_products', 'Loading products...')}</div>
             ) : (
                <div className="overflow-x-auto">
                   <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-500 bg-slate-50/50 border-b border-slate-100 uppercase mt-2">
                         <tr>
                            <th className="py-4 px-6 font-semibold w-12">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-gray-300 cursor-pointer"
                                checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0}
                                onChange={toggleSelectAll}
                              />
                            </th>
                            <th className="py-4 px-6 font-semibold cursor-pointer select-none hover:bg-slate-100 transition" onClick={() => toggleSort("name")}>
                               <div className="flex items-center gap-1"> {t('product_info', 'Product Info')} {sortBy === 'name' && <ArrowUpDown size={14}/>}</div>
                            </th>
                            <th className="py-4 px-6 font-semibold cursor-pointer select-none hover:bg-slate-100 transition" onClick={() => toggleSort("brand")}>
                               <div className="flex items-center gap-1"> {t('brand_manufacturer', 'Brand / Manufacturer')} {sortBy === 'brand' && <ArrowUpDown size={14}/>}</div>
                            </th>
                            <th className="py-4 px-6 font-semibold cursor-pointer select-none hover:bg-slate-100 transition" onClick={() => toggleSort("category")}>
                               <div className="flex items-center gap-1"> {t('category', 'Category')} {sortBy === 'category' && <ArrowUpDown size={14}/>}</div>
                            </th>
                            <th className="py-4 px-6 font-semibold cursor-pointer select-none hover:bg-slate-100 transition" onClick={() => toggleSort("price")}>
                               <div className="flex items-center gap-1"> {t('base_price', 'Base Price')} {sortBy === 'price' && <ArrowUpDown size={14}/>}</div>
                            </th>
                            <th className="py-4 px-6 font-semibold cursor-pointer select-none hover:bg-slate-100 transition" onClick={() => toggleSort("stock")}>
                               <div className="flex items-center gap-1"> {t('stock', 'Stock')} {sortBy === 'stock' && <ArrowUpDown size={14}/>}</div>
                            </th>
                            <th className="py-4 px-6 font-semibold"> {t('status', 'Status')} </th>
                            <th className="py-4 px-6 font-semibold text-right"> {t('actions', 'Actions')} </th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {filteredProducts.map((p) => (
                           <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-4 px-6">
                                <input 
                                  type="checkbox" 
                                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-gray-300 cursor-pointer"
                                  checked={selectedIds.has(p.id)}
                                  onChange={() => toggleSelection(p.id)}
                                />
                              </td>
                              <td className="py-4 px-6">
                                 <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                                       {(p.imageUrl || p.ImageURL || p.image || p.Image) ? (
                                         <img src={p.imageUrl || p.ImageURL || p.image || p.Image} className="w-full h-full object-cover rounded-xl" alt="" />
                                       ) : (
                                         <Tag className="text-slate-400" size={18} />
                                       )}
                                    </div>
                                    <div>
                                       <p className="font-bold text-slate-900 dark:text-white">{p.name || 'Unnamed Product'}</p>
                                       <p className="text-xs text-slate-500">{p.dosage || 'No dosage info'}</p>
                                    </div>
                                 </div>
                              </td>
                              <td className="py-4 px-6">
                                 <span className="text-slate-700">{p.brand || 'Generic'}</span>
                              </td>
                              <td className="py-4 px-6">
                                 <span className="flex w-fit items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium">
                                   <span className="opacity-70">{getCategoryIcon(p.category, 14)}</span>
                                   {p.category || 'Uncategorized'}
                                 </span>
                              </td>
                              <td className="py-4 px-6 font-bold text-slate-700">
                                 {formatCurrency(Number(p.price || 0))}
                              </td>
                              <td className="py-4 px-6">
                                 {p.stock > 0 ? (
                                    <span className="text-slate-700 font-medium">{p.stock}  {t('units', 'units')} </span>
                                 ) : (
                                    <span className="text-red-500 font-bold"> {t('out_of_stock', 'Out of stock')} </span>
                                 )}
                              </td>
                              <td className="py-4 px-6">
                                {p.requiresPrescription ? (
                                  <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg w-max">
                                    <AlertCircle size={12} />  {t('prescription_rx', 'Prescription Rx')} </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg w-max">
                                     {t('otc', 'OTC')} </span>
                                )}
                              </td>
                              <td className="py-4 px-6 text-right">
                                 <div className="flex items-center justify-end gap-2">
                                    <button onClick={() => openEditModal(p)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg transition" title={t('edit', 'Edit')}>
                                       <Edit2 size={16} />
                                    </button>
                                    <button 
                                      onClick={() => handleDelete(p.id)} 
                                      disabled={deletingId === p.id}
                                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition disabled:opacity-50" 
                                      title={t('delete', 'Delete')}
                                    >
                                       {deletingId === p.id ? <Loader2 size={16} className="animate-spin text-red-500" /> : <Trash2 size={16} />}
                                    </button>
                                 </div>
                              </td>
                           </tr>
                         ))}
                         {filteredProducts.length === 0 && (
                           <tr>
                              <td colSpan={8} className="py-8 text-center text-slate-500"> {t('no_products_found', 'No products found.')} </td>
                           </tr>
                         )}
                      </tbody>
                   </table>
                </div>
             )}
          </div>
       </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white dark:bg-zinc-950 rounded-3xl w-full max-w-3xl h-[85vh] max-h-[850px] shadow-2xl border border-gray-100 dark:border-zinc-800 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              
              <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full overflow-hidden">
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-gray-100 dark:border-zinc-900 flex justify-between items-center bg-gray-50/50 dark:bg-zinc-900/10 shrink-0">
                 <div>
                    <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                       {editingId ? t('edit_product', 'Edit Product') : t('add_new_product', 'Add New Product')}
                    </h2>
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mt-0.5">
                       {t('product_form_subtitle', 'Fill out the details below to publish or update this global medication.')}
                    </p>
                 </div>
                 <button 
                    onClick={() => setShowModal(false)} 
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-white dark:bg-zinc-900 shadow-sm border border-gray-100 dark:border-zinc-850 rounded-full p-2 transition"
                 >
                    <X size={18} />
                 </button>
              </div>

              {/* Scrollable Content Area */}
              <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
                 
                 {/* Section 1: Basic Information & Media */}
                 <div className="space-y-4">
                    <h3 className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest bg-teal-50 dark:bg-teal-950/20 px-2.5 py-1 rounded w-fit">
                       1. {t('basic_info_media', 'Basic Info & Media')}
                    </h3>
                    <div className="bg-slate-50/40 dark:bg-zinc-900/20 p-5 rounded-2xl border border-gray-100 dark:border-zinc-850/50 space-y-4">
                       <div className="flex flex-col md:flex-row items-start md:items-center gap-6 pb-4 border-b border-dashed border-gray-100 dark:border-zinc-850">
                          {(watch('imageUrl')) ? (
                             <img src={watch('imageUrl')} className="w-20 h-20 rounded-2xl object-cover border border-slate-200 dark:border-zinc-800 shadow-sm bg-white" alt="Preview"/>
                          ) : (
                             <div className="w-20 h-20 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center shadow-sm shrink-0">
                                <ImageIcon className="text-slate-400" size={32} />
                             </div>
                          )}
                          <div className="space-y-1">
                             <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider"> {t('image_upload', 'Image Upload')} </label>
                             <input 
                               type="file" 
                               accept="image/*" 
                               onChange={handleImageUpload} 
                               className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-teal-50 dark:file:bg-teal-950/40 file:text-teal-700 dark:file:text-teal-400 hover:file:bg-teal-100 cursor-pointer"
                             />
                             <p className="text-[10px] text-slate-400 dark:text-gray-500"> {t('image_upload_desc', 'Recommended image resolution: 400x400px')} </p>
                          </div>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="col-span-1 md:col-span-2">
                             <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider"> {t('product_name', 'Product Name *')} </label>
                                <button 
                                   type="button" 
                                   onClick={handleSingleGenerateInfo} 
                                   disabled={isGeneratingSingle}
                                   className="text-xs text-teal-600 dark:text-teal-400 font-bold hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                   {isGeneratingSingle ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                   {isGeneratingSingle ? "Génération par IA..." : "Auto-Générer avec l'IA"}
                                </button>
                             </div>
                             <input 
                                type="text" 
                                {...register("name", { required: true })} 
                                className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 outline-none transition" 
                                placeholder={t('enter_product_name_placeholder', 'e.g. Paracetamol / Doliprane')}
                             />
                          </div>
                          <div>
                             <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5"> {t('brand', 'Brand / Manufacturer')} </label>
                             <input 
                                type="text" 
                                {...register("brand")} 
                                className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 outline-none transition" 
                                placeholder="e.g. Sanofi"
                             />
                          </div>
                          <div>
                             <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5"> {t('category', 'Category')} </label>
                             <select
                               {...register("category")}
                               className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 outline-none transition"
                             >
                               <option value="">{t('select_category', 'Select Category...')}</option>
                               {categories.map(cat => (
                                 <option key={cat.id} value={cat.name}>{cat.name}</option>
                               ))}
                             </select>
                          </div>
                          <div className="col-span-1 md:col-span-2">
                             <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5"> {t('image_url_label', 'Direct Image URL (Optional)')} </label>
                             <input 
                                type="text" 
                                {...register("imageUrl")} 
                                placeholder="https://..." 
                                className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 outline-none transition" 
                             />
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* Section 2: Pricing, Stock, Regulations */}
                 <div className="space-y-4">
                    <h3 className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest bg-teal-50 dark:bg-teal-950/20 px-2.5 py-1 rounded w-fit">
                       2. {t('pricing_stock_regulations', 'Inventory, Price & Regulations')}
                    </h3>
                    <div className="bg-slate-50/40 dark:bg-zinc-900/20 p-5 rounded-2xl border border-gray-100 dark:border-zinc-850/50 grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div>
                          <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5"> {t('base_price_xaf', 'Base Price (XAF)')} </label>
                          <input 
                             type="number" 
                             step="0.01" 
                             {...register("price", { required: true, min: { value: 0, message: "Le prix doit être positif" }, valueAsNumber: true })} 
                             className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 outline-none transition" 
                             placeholder="e.g. 1500"
                          />
                       </div>
                       <div>
                          <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5"> {t('initial_stock', 'Initial Stock (Units)')} </label>
                          <input 
                             type="number" 
                             {...register("stock", { required: true, min: { value: 0, message: "Le stock doit être positif" }, valueAsNumber: true })} 
                             className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 outline-none transition" 
                             placeholder="e.g. 50"
                          />
                       </div>
                       <div className="col-span-1 md:col-span-2 p-4 bg-white dark:bg-zinc-900 balance-border rounded-xl border border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                          <div className="flex flex-col gap-0.5">
                             <label htmlFor="rx" className="text-sm font-bold text-slate-900 dark:text-white cursor-pointer"> {t('requires_prescription', 'Requires Medical Prescription')} </label>
                             <span className="text-[11px] text-gray-400"> {t('rx_desc', 'Requires valid doctor\'s prescription upload by patients before check out.')} </span>
                          </div>
                          <div className="flex items-center">
                             <input 
                                type="checkbox" 
                                id="rx" 
                                {...register("requiresPrescription")} 
                                className="w-5 h-5 text-teal-600 rounded-lg border-gray-300 dark:border-zinc-750 focus:ring-teal-500 transition cursor-pointer" 
                             />
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* Section 3: Therapeutic Guide */}
                 <div className="space-y-4">
                    <div className="flex items-center justify-between">
                       <h3 className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest bg-teal-50 dark:bg-teal-950/20 px-2.5 py-1 rounded w-fit">
                          3. {t('therapeutic_guide', 'Medical & Therapeutic Guide')}
                       </h3>
                       <button 
                          type="button" 
                          onClick={handleSingleGenerateInfo} 
                          disabled={isGeneratingSingle}
                          className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1 rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                       >
                          {isGeneratingSingle ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                          {isGeneratingSingle ? "Génération..." : "Générer les infos par IA"}
                       </button>
                    </div>
                    <div className="bg-slate-50/40 dark:bg-zinc-900/20 p-5 rounded-2xl border border-gray-100 dark:border-zinc-850/50 space-y-4">
                       <div>
                          <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5"> {t('dosage_format_label', 'Dosage / Format (DCI)')} </label>
                          <input 
                             type="text" 
                             {...register("dosage")} 
                             placeholder="e.g. 500mg Tablets / 80mg per Lyoc" 
                             className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 outline-none transition" 
                          />
                       </div>
                       <div>
                          <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5"> {t('therap_description', 'Product Description')} </label>
                          <textarea 
                             {...register("description")} 
                             rows={2} 
                             className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 outline-none transition resize-none" 
                             placeholder={t('explain_details_desc', 'Explain composition, clinical uses or active molecules...')}
                          />
                       </div>
                       <div>
                          <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5"> {t('effects_side', 'Known Side Effects')} </label>
                          <textarea 
                             {...register("effects")} 
                             rows={2} 
                             className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 outline-none transition resize-none" 
                             placeholder={t('effects_placeholder', 'Drowsiness, stomach ache, allergic warnings, etc.')}
                          />
                       </div>
                       <div>
                          <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5"> {t('directions_use', 'Directions & Method of Use')} </label>
                          <textarea 
                             {...register("directions")} 
                             rows={2} 
                             className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 outline-none transition resize-none" 
                             placeholder={t('directions_placeholder', 'e.g. Take 1 tablet three times a day after meals with water.')}
                          />
                       </div>
                    </div>
                 </div>

              </div>

              {/* Sticky Action Footer */}
              <div className="px-8 py-5 border-t border-gray-100 dark:border-zinc-900 bg-gray-50 dark:bg-zinc-900/30 flex justify-end gap-3 shrink-0">
                 <button 
                    type="button"
                    onClick={() => setShowModal(false)} 
                    className="px-5 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-900 rounded-xl transition"
                 > 
                    {t('cancel', 'Cancel')} 
                 </button>
                 <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="px-6 py-3 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 rounded-xl shadow-md dark:shadow-none transition transform active:scale-95 disabled:opacity-50 flex items-center gap-2"
                 >
                    {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                    {isSubmitting ? "Enregistrement..." : (editingId ? t('update_product', 'Update Product') : t('save_product', 'Save Product'))}
                 </button>
              </div>
              </form>
            </div>
         </div>
      )}
    </div>
  );
}
