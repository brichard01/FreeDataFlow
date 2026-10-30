import pickle

import pandas as pd
from sklearn.metrics import accuracy_score, f1_score

from freedataflow import reads, writes

reads("iris_model")
reads("iris_test")
writes("iris_scores")

test = pd.read_csv("data/iris_test.csv")
with open("data/iris_model.pkl", "rb") as f:
    model = pickle.load(f)

predictions = model.predict(test.drop(columns="species"))
accuracy = accuracy_score(test["species"], predictions)
f1 = f1_score(test["species"], predictions, average="macro")

with open("data/scores.txt", "w") as f:
    f.write(f"accuracy: {accuracy:.3f}\n")
    f.write(f"f1_macro: {f1:.3f}\n")
