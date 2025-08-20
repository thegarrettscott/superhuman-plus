# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/89b580f0-268d-42fd-b2eb-79e806ae2fa7

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/89b580f0-268d-42fd-b2eb-79e806ae2fa7) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/89b580f0-268d-42fd-b2eb-79e806ae2fa7) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

---

## Cross-site proxy calls to Supabase Edge Functions

You can call our Supabase Edge Functions from a different website, as long as the user is authenticated in this app in the same browser. Functions are CORS-enabled and require a Bearer JWT.

### 1) Configure allowed origins
Edit `src/pages/TokenBroker.tsx` and add your trusted external origins to `allowedOrigins`:

```ts
const allowedOrigins = [
  "https://your-external-app.example.com",
  // add more origins as needed
];
```

Then visit `/token-broker` while signed in to ensure it loads.

### 2) Obtain a user token in your external site (via postMessage)
Embed a hidden iframe that points to this app’s token broker and request a token:

```html
<iframe id="token-broker" src="https://<your-main-app-domain>/token-broker" style="display:none"></iframe>
```

```js
const appOrigin = "https://<your-main-app-domain>";
const brokerFrame = document.getElementById("token-broker").contentWindow;

function requestSupabaseToken() {
  return new Promise((resolve, reject) => {
    const listener = (event) => {
      if (event.origin !== appOrigin) return; // security check
      const { type, access_token } = event.data || {};
      if (type === "SUPABASE_TOKEN") {
        window.removeEventListener("message", listener);
        if (!access_token) return reject(new Error("No active session"));
        resolve(access_token);
      }
    };
    window.addEventListener("message", listener);
    brokerFrame.postMessage({ type: "REQUEST_SUPABASE_TOKEN" }, appOrigin);
  });
}
```

### 3) Call the Edge Functions with the token
Use the token as a Bearer in the Authorization header. Example (fetch):

```js
const base = "https://wfjeaievpekysbcoptxa.functions.supabase.co";
const token = await requestSupabaseToken();

// email-filter
await fetch(`${base}/email-filter`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ action: "test-filters", emailData: {/* ... */}, filters: [/* ... */] }),
});

// gmail-actions (e.g., import INBOX)
await fetch(`${base}/gmail-actions`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ action: "import", mailbox: "inbox", max: 20 }),
});

// process-filters (rule-based local processing)
await fetch(`${base}/process-filters`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  },
});
```

Available function endpoints:
- `https://wfjeaievpekysbcoptxa.functions.supabase.co/email-filter`
- `https://wfjeaievpekysbcoptxa.functions.supabase.co/gmail-actions`
- `https://wfjeaievpekysbcoptxa.functions.supabase.co/process-filters`

Notes:
- The token broker never stores tokens; it only relays the current session’s access token via `postMessage` to allowed origins.
- If you receive `401 Unauthorized`, request a fresh token again (sessions can expire/rotate).
- Only add trusted origins to `allowedOrigins`.

