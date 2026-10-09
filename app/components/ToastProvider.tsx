"use client"; // <--- Ye Zaroori hai

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function ToastProvider() {
  return (
    <ToastContainer 
      position="bottom-right" // POS ke liye best jagah
      autoClose={3000}        // 3 second baad khud band ho jayega
      hideProgressBar={false}
      newestOnTop={true}
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme="light"           // Ya "colored" use karein for dark colors
    />
  );
}