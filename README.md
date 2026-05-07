# Nexus Sales Analytics

A professional business intelligence system for real-time sales analysis.

## Project Overview
This system provides high-level insights into company sales performance, including revenue tracking, profit analysis, and machine learning-powered forecasting.

## Tech Stack
- **Frontend:** React (Vite) + Tailwind CSS + Recharts
- **Analytics:** Python, Pandas, Scikit-learn
- **AI:** Google Gemini API for deep business insights
- **Dashboard:** Streamlit (alternative interactive web app)

## Getting Started

### 1. Python Environment Setup
```bash
pip install pandas numpy scikit-learn matplotlib seaborn streamlit plotly
```

### 2. Generate Initial Data
```bash
python scripts/clean_data.py
```

### 3. Run ML Forecasting
```bash
python scripts/forecasting.py
```

### 4. Launch Streamlit Dashboard
```bash
streamlit run streamlit_app/app.py
```

## Features
- Interactive KPI Cards
- Regional Performance Heatmaps
- AI Forecasting Models
- Executive PDF Reporting
- SQL Integration support
