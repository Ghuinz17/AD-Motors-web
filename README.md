# AD Motor's — Platform

**Full-stack platform for vehicle listing and management, built with React Native, Expo and Supabase.**

[![Node.js](https://img.shields.io/badge/Node.js-v24.13.1-green)](https://nodejs.org/)
[![React Native](https://img.shields.io/badge/React%20Native-0.74.5-blue)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-51.0.39-black)](https://expo.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-2.45.1-green)](https://supabase.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3.3-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## Description

**AD Motors** is a complete platform for browsing, reserving and managing second-hand vehicles. It consists of two parts: a **public-facing web application** for customers and an **Android administration app** for staff. Both share the same Supabase backend.

**Key features:**
- Full vehicle catalogue with search and filtering
- Vehicle reservation with payment gateway (card, PayPal, Bizum)
- Visit request system with date and time scheduling
- User authentication via email and OTP code
- User profile with order history and account management
- Support and help contact form
- Light and dark theme
- Administration app for managing vehicles, reservations and visit requests

---

## Technology Stack

### Web
- HTML5, CSS3, Vanilla JavaScript
- Supabase JavaScript Client
- EmailJS
- Font Awesome 6
- Google Fonts — Barlow, Barlow Condensed
- Vercel (deployment)

### Mobile (Android Administration App)
- React Native 0.74.5
- Expo 51.0.39
- TypeScript 5.3.3
- @react-navigation/native-stack
- Supabase 2.45.1
- expo-image-picker 15.1.0
- @expo/vector-icons 14.0.3
- react-native-safe-area-context 4.10.5
- base64-arraybuffer 1.0.2

---

## Features

### Customer (Web)

| Feature | Description |
|---|---|
| Vehicle catalogue | Browse all available vehicles with advanced search and filtering |
| Vehicle detail | Image gallery with lightbox, full specs and pricing |
| Reservation | Reserve a vehicle with a 25 EUR deposit via simulated payment gateway |
| Visit request | Schedule a personal visit to view a vehicle |
| User account | Register, log in, manage orders and visit requests |
| Support form | Contact the team directly from the website |

### Administration (Android App)

| Feature | Description |
|---|---|
| Vehicle management | Create, edit, view and delete vehicle listings with images |
| Visit request management | Accept or reject requests, contact customers directly |
| Reservation management | View and release reserved vehicles |

---

## Requirements

- Node.js 24.13.1 or higher
- npm or yarn
- Expo CLI installed globally
- Supabase account — [supabase.com](https://supabase.com)
- EmailJS account — [emailjs.com](https://emailjs.com)
- Git

---

## Usage

### Web
Open `index.html` locally or access the deployed version. Customers can browse vehicles, create an account, reserve a vehicle or request a visit.

### Mobile App
1. Clone the repository
2. Run `npm install --legacy-peer-deps`
3. Configure `src/config/supabase.ts` with your Supabase credentials
4. Run `npx expo start`
5. Build for Android with `eas build --platform android --profile preview`

---

## Email Notifications

The platform sends automated emails for account confirmation, reservation confirmation, visit requests, password reset and email changes. All templates are built with inline HTML and CSS for full email client compatibility.

---

## License

This project is licensed under the MIT License. See the `LICENSE` file for full terms.

---

## Author

**Antonio Jose Molero Perez**

- GitHub: [@Ghuinz17](https://github.com/Ghuinz17)
- Email: ajmolero797@gmail.com

---

## Acknowledgements

This platform was developed for and in collaboration with **AD Motor's**.

- Instagram: [vehiculosadmotors](https://www.instagram.com/vehiculosadmotors)
- Facebook: [AD Motors](https://www.facebook.com/people/AD-Motors/61584583105868/)
- TikTok: Coming soon
