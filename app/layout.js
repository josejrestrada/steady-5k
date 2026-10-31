import './globals.css';

export const metadata = {
  title: 'Steady 5K',
  description: 'A running coach that gets you to 5K without stopping. One message a day, no forms.',
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='46' fill='%2314342b'/><path d='M28 62 L46 44 L56 54 L74 34' stroke='%23f2a541' stroke-width='9' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>",
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#14342b',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
