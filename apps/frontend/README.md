# Frontend Dashboard Application

This repository contains the frontend application for a comprehensive dashboard, built with Next.js and TypeScript. It provides a robust, interactive web interface for managing various aspects of a system, including user authentication, client data, user profiles, content uploads, download tracking, and general system metadata. This application is designed for administrators and authorized users who require a centralized platform to oversee and interact with core system functionalities.

## Features

*   **User Authentication**: Secure login and registration flows for user access.
*   **Dashboard Overview**: A central hub providing a high-level view of key system metrics and activities.
*   **User Management**: Tools for listing, creating, updating, and managing user accounts.
*   **Client Management**: Functionality to handle client data and associated information.
*   **Downloads Management**: Interface for overseeing and tracking downloadable assets.
*   **Metadata Management**: Tools to manage and categorize system-wide metadata.
*   **Profile Management**: Users can view and update their personal profiles and settings.
*   **Content Uploads**: Dedicated sections for uploading files or other resources.
*   **Dynamic Views**: Components for visualizing data or specific content views.
*   **Role-Based Permissions**: Granular access control based on user roles (inferred from `use-permission` and `lib/permissions`).
*   **Responsive Design**: Optimized for various screen sizes, including mobile devices (inferred from `use-mobile`).

## Tech Stack

The application leverages a modern and robust set of technologies:

*   **Framework**: Next.js (React)
*   **Language**: TypeScript
*   **Styling**: Tailwind CSS, PostCSS, Autoprefixer, `class-variance-authority`, `clsx`, `tailwind-merge`
*   **UI Components**: `@repo/ui` (shared UI library), `lucide-react` (icons)
*   **Animation**: `framer-motion`, `gsap`
*   **Monorepo Tools**: `@repo/theme`, `@repo/eslint-config`, `@repo/typescript-config`
*   **Linting**: ESLint

## Installation

To get this project up and running locally, follow these steps:

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/theharshalchaudhari/data-merge.git
    cd data-merge
    ```

2.  **Install dependencies**:
    ```bash
    pnpm install
    ```

3.  **Start the development server**:
    ```bash
    pnpm run dev
    ```

    The application will be accessible at `http://localhost:3000`.

## Usage

Once the development server is running, open your web browser and navigate to `http://localhost:3000`.

*   The authentication routes are available under `/(auth)`, e.g., `/login` and `/register`.
*   The main dashboard and management sections are accessible under `/(dashboard)`, e.g., `/dashboard`, `/clients`, `/users`, etc.

To build the application for production:

```bash
npm run build
```

To run the production build locally:

```bash
pnpm build
```

## Project Structure

The project follows a standard Next.js App Router structure, organized for clarity and maintainability:

```
frontend/
├── app/                      # Next.js App Router root
│   ├── (auth)/               # Routes related to user authentication (login, register)
│   ├── (dashboard)/          # Main application routes (dashboard, clients, users, etc.)
│   ├── globals.css           # Global stylesheets, primarily for Tailwind CSS
│   ├── layout.tsx            # Root layout for the application
│   └── page.tsx              # Homepage component
├── components/               # Reusable React components
│   ├── clients/              # Components specific to client management
│   ├── dashboard/            # Components for the main dashboard view
│   ├── downloads/            # Components for managing downloads
│   ├── layout/               # Layout-related components (e.g., navigation, sidebar)
│   ├── metadata/             # Components for metadata management
│   ├── profile/              # Components for user profile management
│   ├── shared/               # Commonly used, generic UI components
│   ├── upload/               # Components for file/resource uploads
│   ├── users/                # Components specific to user management
│   └── views/                # Components for specific data views or visualizations
├── hooks/                    # Custom React hooks for shared logic
│   ├── use-auth.ts           # Hook for authentication state and actions
│   ├── use-mobile.ts         # Hook for detecting mobile viewport or responsiveness
│   └── use-permission.ts     # Hook for checking user permissions
├── lib/                      # Utility functions, API clients, and business logic
│   ├── api.ts                # API client configuration and helpers
│   ├── auth.ts               # Authentication-related utility functions
│   ├── constants.ts          # Application-wide constants
│   ├── permissions.ts        # Logic for managing user roles and permissions
│   └── utils.ts              # General utility functions
├── public/                   # Static assets (images, fonts, etc.)
│   └── Logo.svg              # Project logo
├── middleware.ts             # Next.js middleware for request interception and routing logic
├── next-env.d.ts             # TypeScript declaration file for Next.js environment
├── next.config.ts            # Next.js configuration file
├── package.json              # Project dependencies and scripts
├── postcss.config.mjs        # PostCSS configuration, used with Tailwind CSS
└── tsconfig.json             # TypeScript compiler configuration
```

## Configuration

No explicit environment variables or configuration requirements were identified in the provided project metadata and source code. However, typical Next.js applications often rely on `.env` files for API endpoints, authentication secrets, or other sensitive configuration.

## Contributing

We welcome contributions to this project! If you're looking to contribute, please follow these guidelines:

1.  **Fork** the repository.
2.  **Clone** your forked repository to your local machine.
3.  **Create a new branch** for your feature or bug fix: `git checkout -b feature/your-feature-name` or `bugfix/issue-description`.
4.  **Make your changes**. Ensure your code adheres to the existing style and conventions.
5.  **Test your changes** thoroughly.
6.  **Commit your changes** with a clear and concise message: `git commit -m "feat: Add new feature"`.
7.  **Push your branch** to your forked repository: `git push origin feature/your-feature-name`.
8.  **Open a Pull Request** to the `main` branch of this repository, describing your changes in detail.

## License

This project does not currently specify a license.
