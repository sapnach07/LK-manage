/**
 * Compresses an image file to a maximum dimension of ~800px
 * while preserving aspect ratio and converting to a lightweight JPEG DataURL.
 */
export async function compressImageFile(file: File, maxDimension = 800, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    // Basic file validation
    if (!file.type.startsWith('image/')) {
      reject(new Error('Le fichier sélectionné doit être une image.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Erreur lors de la lecture du fichier image.'));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Impossible de charger l'image."));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Impossible de préparer le contexte de compression canvas.'));
          return;
        }

        // Fill background with white in case of transparent PNGs
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // Draw resized image
        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG with good compression
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };

      if (event.target?.result) {
        img.src = event.target.result as string;
      }
    };

    reader.readAsDataURL(file);
  });
}
