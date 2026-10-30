import pickle

import pandas as pd
from sklearn.linear_model import LogisticRegression

from freedataflow import reads, writes

reads("iris_train")
writes("iris_model")

train = pd.read_csv("data/iris_train.csv")
model = LogisticRegression(max_iter=1000)
model.fit(train.drop(columns="species"), train["species"])

with open("data/iris_model.pkl", "wb") as f:
    pickle.dump(model, f)
