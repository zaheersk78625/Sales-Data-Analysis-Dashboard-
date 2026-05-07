import pandas as pd
import numpy as np
from datetime import datetime, timedelta

def generate_sales_data(num_records=1000):
    np.random.seed(42)
    
    categories = ['Electronics', 'Furniture', 'Office Supplies', 'Technology']
    regions = ['North', 'South', 'East', 'West']
    segments = ['Consumer', 'Corporate', 'Home Office']
    products = {
        'Electronics': ['Phone', 'Laptop', 'Tablet', 'Headphones', 'Monitor'],
        'Furniture': ['Chair', 'Desk', 'Table', 'Sofa', 'Bookshelf'],
        'Office Supplies': ['Paper', 'Pens', 'Binders', 'Stapler', 'Storage'],
        'Technology': ['Keyboards', 'Mice', 'Webcam', 'Cables', 'Adapters']
    }
    
    data = []
    start_date = datetime(2023, 1, 1)
    
    for i in range(num_records):
        order_date = start_date + timedelta(days=np.random.randint(0, 480))
        category = np.random.choice(categories)
        product = np.random.choice(products[category])
        region = np.random.choice(regions)
        segment = np.random.choice(segments)
        
        quantity = np.random.randint(1, 10)
        base_price = np.random.uniform(10, 500)
        if category == 'Technology': base_price *= 1.5
        
        sales = round(base_price * quantity, 2)
        profit = round(sales * np.random.uniform(0.05, 0.35), 2)
        discount = round(np.random.uniform(0, 0.2), 2)
        
        data.append({
            'OrderID': f'ORD-{1000 + i}',
            'OrderDate': order_date.strftime('%Y-%m-%d'),
            'Category': category,
            'Product': product,
            'Region': region,
            'Segment': segment,
            'Sales': sales,
            'Quantity': quantity,
            'Profit': profit,
            'Discount': discount
        })
        
    df = pd.DataFrame(data)
    df.to_csv('data/sales.csv', index=False)
    print("Dataset generated successfully in data/sales.csv")

if __name__ == "__main__":
    import os
    if not os.path.exists('data'):
        os.makedirs('data')
    generate_sales_data()
