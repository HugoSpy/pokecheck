export const isDevEnv =
  import.meta.env.VITE_ENV !== 'production' &&
  (import.meta.env.VITE_ENV === 'development' ||
   String(import.meta.env.VITE_API_URL ?? '').includes('api-dev'));

export const patchNotes = [
  {
    version: 'v1.0',
    date: '03/06/2026 16:40',
    items: [
      "Profil : possibilité de modifier son nom d'utilisateur",
    ],
  },
];
