import { fetchApi } from './apiClient';

export async function seedProducts(data: any[]) {
  try {
    // 1. Validation and Mapping
    const dataToInsert = data.map((item) => {
      const dci = item.dci;
      const nom_commercial = item.nom_commercial || item.commercial_name;
      
      if (!dci) {
        throw new Error(`Validation failed: 'dci' is mandatory. Record: ${JSON.stringify(item)}`);
      }
      
      if (!nom_commercial) {
        throw new Error(`Validation failed: 'nom_commercial' is mandatory. Record: ${JSON.stringify(item)}`);
      }

      return {
        dci: dci,
        commercial_name: nom_commercial,
        dosage: item.dosage,
        form: item.forme || item.form,
        is_prescription_required: Boolean(item.ordonnance_requise ?? item.is_prescription_required ?? false),
        ux_category: item.categorie_ux || item.ux_category,
      };
    });

    if (dataToInsert.length === 0) {
      console.log('No valid data to insert.');
      return null;
    }

    // 2. Database Insertion (via backend API with Service Role Key)
    const response = await fetchApi('/api/admin/seed-products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ data: dataToInsert })
    });

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to seed products via API');
    }

    return result.data;
  } catch (error: any) {
    console.error('Erreur complète:', error);
    throw error;
  }
}
