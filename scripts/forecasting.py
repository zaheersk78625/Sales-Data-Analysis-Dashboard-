import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error
import joblib
import os

def train_forecasting_model():
    # Load data
    if not os.path.exists('data/sales.csv'):
        print("Data file not found. Run clean_data.py first.")
        return

    df = pd.DataFrame(pd.read_csv('data/sales.csv'))
    df['OrderDate'] = pd.to_datetime(df['OrderDate'])
    
    # Preprocessing for time series
    daily_sales = df.groupby('OrderDate')['Sales'].sum().reset_index()
    daily_sales['DayOfWeek'] = daily_sales['OrderDate'].dt.dayofweek
    daily_sales['Month'] = daily_sales['OrderDate'].dt.month
    daily_sales['Day'] = daily_sales['OrderDate'].dt.day
    
    # Lag features
    daily_sales['PrevDaySales'] = daily_sales['Sales'].shift(1)
    daily_sales = daily_sales.dropna()
    
    X = daily_sales[['DayOfWeek', 'Month', 'Day', 'PrevDaySales']]
    y = daily_sales['Sales']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    
    predictions = model.predict(X_test)
    mae = mean_absolute_error(y_test, predictions)
    print(f"Model Mean Absolute Error: {mae}")
    
    if not os.path.exists('outputs'):
        os.makedirs('outputs')
    joblib.dump(model, 'outputs/sales_model.pkl')
    print("Model saved to outputs/sales_model.pkl")

if __name__ == "__main__":
    train_forecasting_model()
