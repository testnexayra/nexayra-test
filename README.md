# Nexayra Arc — Document Portal

Generate LPOs, Quotations, and Receiver Copies with PDF generation, Firebase auth, and approval workflows.

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript** + **Tailwind CSS**
- **Firebase** (Auth + Firestore)
- **@react-pdf/renderer** (PDF generation)
- **Recharts** (Dashboard charts)

---

## Setup Instructions

### 1. Open the project in VS Code

```bash
cd nexayra-docs
code .
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a project (or use existing)
3. Enable **Authentication** → Email/Password sign-in
4. Enable **Cloud Firestore**
5. Create users in Firebase Auth for your team
6. Go to **Project Settings → Service Accounts → Generate new private key**

### 4. Configure environment variables

Copy `.env.local.example` to `.env.local` and fill in your Firebase values:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your Firebase config (from Project Settings → General → Your apps → Web app config) and service account details.

### 5. Add public assets

Place these files in the `public/` folder:
- `letterhead-bg.png` — Your A4 letterhead background image
- `approved-stamp.png` — Approval stamp image
- `quotation-signature.png` — Signature image
- `nexayra.png` — Company logo

### 6. Run locally

```bash
npm run dev
```

Visit `http://localhost:3000`

### 7. Deploy to Vercel (recommended)

```bash
npm install -g vercel
vercel
```

Add your `.env.local` variables in Vercel's dashboard under **Settings → Environment Variables**.

---

## Project Structure

```
nexayra-docs/
├── src/
│   ├── app/
│   │   ├── page.tsx                          # Login page
│   │   ├── layout.tsx                        # Root layout
│   │   ├── globals.css                       # Global styles
│   │   ├── api/lpo/route.ts                  # LPO creation API
│   │   └── dashboard/
│   │       ├── layout.tsx                    # Dashboard layout (sidebar + auth)
│   │       ├── page.tsx                      # Dashboard with pie chart
│   │       ├── lpo/
│   │       │   ├── page.tsx                  # Create LPO
│   │       │   └── history/page.tsx          # LPO History + Approval
│   │       ├── quotation/
│   │       │   ├── page.tsx                  # Create Quotation
│   │       │   └── history/page.tsx          # Quotation History
│   │       └── receiver-copy/
│   │           ├── page.tsx                  # Create Receiver Copy
│   │           └── history/page.tsx          # Receipt History
│   ├── components/
│   │   ├── AuthGuard.tsx                     # Auth protection
│   │   ├── Sidebar.tsx                       # Navigation sidebar
│   │   ├── lpo/
│   │   │   ├── CreateLPO.tsx                 # LPO form
│   │   │   ├── LpoDocument.tsx               # LPO PDF template
│   │   │   └── LpoHistory.tsx                # LPO list + approve
│   │   ├── quotation/
│   │   │   ├── CreateQuotation.tsx            # Quotation form
│   │   │   ├── QuotationDocument.tsx          # Quotation PDF template
│   │   │   └── QuotationHistory.tsx           # Quotation list
│   │   └── receiver-copy/
│   │       ├── CreateReceiverCopy.tsx         # Receiver copy form
│   │       ├── ReceiverCopyDocument.tsx       # Receipt PDF template
│   │       └── ReceiverCopyHistory.tsx        # Receipt list
│   └── lib/
│       ├── firebase.ts                       # Client SDK
│       └── firebase-admin.ts                 # Admin SDK (API routes)
├── public/                                   # Letterhead, stamp, signature, logo
├── package.json
├── tailwind.config.js
├── next.config.js
└── tsconfig.json
```

## Firestore Collections

| Collection       | Doc ID Format   | Key Fields                         |
|------------------|-----------------|------------------------------------|
| `lpos`           | `LPO-{nxrNo}`  | All LPO fields + `approved`, `approvedBy` |
| `quotations`     | `QTN_NEX_{num}` | All quotation fields               |
| `receiverCopies` | `RC_NEX_{num}`  | All receipt fields                 |
| `counters`       | `lpo`           | `current` (auto-incrementing)      |

## Features

- **Login** — Firebase Email/Password auth
- **Dashboard** — Pie chart showing document counts per type
- **LPO** — Create, download PDF, share, view history, approve with name + stamp
- **Quotation** — Create with BOQ, inclusions/exclusions, download PDF, share
- **Receiver Copy** — Cheque receipt with auto amount-in-words, download PDF, share
- **Draft auto-save** — All forms persist to localStorage
- **Responsive** — Works on desktop, tablet, and mobile
