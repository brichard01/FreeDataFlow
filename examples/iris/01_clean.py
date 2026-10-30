from pathlib import Path

import pandas as pd

from freedataflow import writes

writes("iris_clean")

URL = "https://raw.githubusercontent.com/mwaskom/seaborn-data/master/iris.csv"

Path("data").mkdir(exist_ok=True)
df = pd.read_csv(URL)
df = df.dropna().drop_duplicates()
df.to_csv("data/iris_clean.csv", index=False)
