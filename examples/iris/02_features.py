import pandas as pd

from freedataflow import reads, writes

reads("iris_clean")
writes("iris_features")

df = pd.read_csv("data/iris_clean.csv")
df["petal_ratio"] = df["petal_length"] / df["petal_width"]
df.to_csv("data/iris_features.csv", index=False)
