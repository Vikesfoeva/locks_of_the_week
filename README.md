# Locks of the Week

A web application for managing and displaying weekly sports picks and predictions.

## Overview

This project provides a platform for users to view and manage their weekly sports picks, with a focus on both NFL and CFB games. The application features a modern, responsive interface and real-time updates.

## Features

- Weekly picks management for NFL and CFB games
- User authentication and profile management
- Real-time updates and notifications
- Responsive design for all devices
- Image management for team logos and game-related content

## Project Structure

```
locks_of_the_week/
├── cfb_images/        # College Football related images
├── nfl_images/        # NFL related images
├── product_requirements.md  # Detailed project requirements
└── to_do.md          # Project tasks and milestones
```

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Vikesfoeva/locks_of_the_week.git
   cd locks_of_the_week
   ```

2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

## Development

- Follow PEP 8 style guide for Python code
- Write tests for new features
- Update documentation as needed
- Use meaningful commit messages

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contact

For questions and support, please open an issue in the GitHub repository. 