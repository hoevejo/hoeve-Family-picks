# 🏈 NFL Pick'em App

A feature-rich, family-focused NFL Pick'em app built with **Next.js**, **Firebase**, and **Tailwind CSS**. Users can predict weekly NFL game winners, track scores on a leaderboard, and view recaps — all with a sleek, responsive UI.

---

## 🚀 Features

- 🔐 **User Authentication** via Firebase
- 📊 **Leaderboard** with Regular Season, Postseason, and All-Time tabs
- 🗓️ **Weekly Predictions** with records, game info, and deadlines
- ✅ **Automatic Result Updates** via Vercel cron jobs
- 🔁 **Weekly Recaps** highlighting top scorers and leaderboard movement
- 🕰️ **History Archive** for viewing past weeks and seasons
- 📥 **Push Notifications** for reminders and results (PWA compatible)
- 🖼️ **Custom Profile Pictures** from curated avatar sets
- 🎨 **Theme Support** and smooth UI transitions

---

## 🧠 Tech Stack

- **Frontend**: Next.js (App Router), Tailwind CSS, Framer Motion
- **Backend**: Firebase Authentication & Firestore
- **Jobs / Cron**: Vercel Serverless Functions (e.g., `fetchGames`, `calculateWeeklyResults`)
- **Notifications**: Web Push with Firestore token storage and secure trigger endpoints
- **CI/CD**: Vercel for automatic builds and deployments

---

## 🛠️ Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-username/nfl-pickem-app.git
cd nfl-pickem-app
npm install
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NOTIFICATION_SECRET=your_secure_notification_key
FIREBASE_ADMIN_KEY=your_admin_json_parsed_key

📁 Folder Structure
/app
  ├── (protected)/           # Authenticated routes (leaderboard, predictions, profile)
  ├── (public)/              # Login and register pages
  └── api/                   # Serverless functions (jobs, notifications)

/jobs                        # Vercel job logic (fetching games, calculating results)
/lib                         # Firebase config, Firestore helpers, utility functions
/components                 # Shared UI components and layout wrappers

🧪 Future Roadmap
🎲 Wager Match Bonus Point System

🧑‍🤝‍🧑 League/Group Support for Friends and Communities

🏆 Awards for streaks, upset picks, and seasonal records

📈 Admin Dashboard Analytics

🕹️ Interactive Draft Pick feature (experimental)

Developed by Jon Hoeve
Built to bring family and friends together for a fun and competitive NFL season.
```
