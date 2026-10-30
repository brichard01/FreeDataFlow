import pandas as pd
from sklearn.model_selection import train_test_split

from freedataflow import reads, writes

reads("iris_features")
writes("iris_train")
writes("iris_test")

df = pd.read_csv("data/iris_features.csv")
train, test = train_test_split(df, test_size=0.2, random_state=42, stratify=df["species"])
train.to_csv("data/iris_train.csv", index=False)
test.to_csv("data/iris_test.csv", index=False)
