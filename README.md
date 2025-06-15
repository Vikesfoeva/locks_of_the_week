# Locks of the Week

A React-based web application for participating in a weekly sports picking contest.

## Overview

This project is a full-stack application that allows users to register, log in, and submit their weekly picks for sports games. It features a user-friendly interface, authentication, and a backend to manage users, picks, and standings.

## Features

-   **User Authentication**: Sign up, log in, and log out functionality using Firebase Authentication (Email/Password and Google).
-   **Weekly Picks**: Users can submit their picks for the week's games.
-   **Dashboard**: A personalized dashboard for each user.
-   **Standings**: View the leaderboard and user rankings.
-   **Admin Panel**: A dashboard for administrators to manage the application.
-   **Responsive Design**: The application is designed to work on various screen sizes.

## Tech Stack

### Frontend

-   [React](https://reactjs.org/)
-   [Vite](https://vitejs.dev/)
-   [Tailwind CSS](https://tailwindcss.com/)
-   [React Router](https://reactrouter.com/)
-   [Headless UI](https://headlessui.dev/)
-   [Heroicons](https://heroicons.com/)

### Backend

-   [Firebase Authentication](https://firebase.google.com/docs/auth)
-   A separate backend server is required (e.g., Node.js/Express) to handle API requests.

## Project Structure

The frontend application code is located in the `src/` directory.

```
src/
├── components/   # Reusable React components
├── contexts/     # React context providers (e.g., AuthContext)
├── pages/        # Application pages/routes
├── App.jsx       # Main application component with routing
├── main.jsx      # Entry point of the application
└── index.css     # Global styles
```

## Setup and Installation

To run this project locally, you will need to have [Node.js](httpss://nodejs.org) installed.

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```

2.  **Install frontend dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**

    Create a `.env` file in the root of the project and add your Firebase project configuration:

    ```
    VITE_FIREBASE_API_KEY=your_api_key
    VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
    VITE_FIREBASE_PROJECT_ID=your_project_id
    VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
    VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
    VITE_FIREBASE_APP_ID=your_app_id
    VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
    ```

4.  **Backend Server:**

    This frontend application expects a backend server running on `localhost:5001`. Make sure you have the backend server for this project set up and running.

5.  **Run the application:**
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:5173`.

## Available Scripts

In the project directory, you can run:

-   `npm run dev`: Runs the app in development mode.
-   `npm run build`: Builds the app for production.
-   `npm run lint`: Lints the project files.
-   `npm run preview`: Serves the production build locally.

## Contributing

Contributions are welcome! Please follow these steps:

1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/your-feature-name`).
3.  Make your changes.
4.  Commit your changes (`git commit -m 'Add some feature'`).
5.  Push to the branch (`git push origin feature/your-feature-name`).
6.  Open a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contact

For questions and support, please open an issue in the GitHub repository. 