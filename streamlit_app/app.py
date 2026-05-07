import streamlit as st
import pandas as pd
import plotly.express as px
import os

st.set_page_config(page_title="Nexus Sales Dashboard", layout="wide")

st.title("📊 Nexus Business Intelligence Dashboard")
st.markdown("Real-time Sales Performance & Forecasting")

# Sidebar
st.sidebar.header("Filter Options")
if os.path.exists('data/sales.csv'):
    df = pd.read_csv('data/sales.csv')
    
    region = st.sidebar.multiselect("Select Region", options=df['Region'].unique(), default=df['Region'].unique())
    category = st.sidebar.multiselect("Select Category", options=df['Category'].unique(), default=df['Category'].unique())
    
    filtered_df = df[(df['Region'].isin(region)) & (df['Category'].isin(category))]
    
    # KPIs
    kpi1, kpi2, kpi3, kpi4 = st.columns(4)
    kpi1.metric("Total Revenue", f"${filtered_df['Sales'].sum():,.2f}")
    kpi2.metric("Total Profit", f"${filtered_df['Profit'].sum():,.2f}")
    kpi3.metric("Total Orders", len(filtered_df))
    kpi4.metric("Avg Discount", f"{filtered_df['Discount'].mean()*100:.1f}%")
    
    # Charts
    c1, c2 = st.columns(2)
    with c1:
        st.subheader("Sales by Category")
        fig = px.pie(filtered_df, values='Sales', names='Category', hole=0.4)
        st.plotly_chart(fig, use_container_width=True)
        
    with c2:
        st.subheader("Monthly Sales Trend")
        df_trend = filtered_df.copy()
        df_trend['OrderDate'] = pd.to_datetime(df_trend['OrderDate'])
        monthly_trend = df_trend.groupby(df_trend['OrderDate'].dt.to_period('M'))['Sales'].sum().reset_index()
        monthly_trend['OrderDate'] = monthly_trend['OrderDate'].astype(str)
        fig = px.line(monthly_trend, x='OrderDate', y='Sales')
        st.plotly_chart(fig, use_container_width=True)

else:
    st.error("No data found. Please check data/sales.csv")
