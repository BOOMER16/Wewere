import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Alliance Basketball | Tournament dashboard',description:'Teams, fixtures, live player scoring and match reports for Alliance Basketball.',icons:{icon:'/alliance-logo.png'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
