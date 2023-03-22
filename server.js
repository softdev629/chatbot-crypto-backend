import express from "express";
import * as dotenv from "dotenv";
import cors from "cors";
import readXlsxFile from "read-excel-file/node";
import { loadQAStuffChain, loadQAChain } from "langchain/chains";
import { OpenAI } from "langchain/llms";
import { Document } from "langchain/document";
import { BufferMemory } from "langchain/memory";
import { PromptTemplate } from "langchain";
import { CharacterTextSplitter } from "langchain/text_splitter";

// delcares schema of converted json file
const schema = {
  Name: {
    prop: "name",
    type: String,
  },
  "Token Symbol": {
    prop: "tokenSymbol",
    type: String,
  },
  Date: {
    prop: "date",
    type: Date,
  },
  Released: {
    prop: "released",
    type: String,
  },
  Price: {
    prop: "price",
    type: Number,
  },
  "7d Change": {
    prop: "weekChange",
    type: Number,
  },
  "30d Change": {
    prop: "monthChange",
    type: Number,
  },
  "Market Cap": {
    prop: "marketCap",
    type: Number,
  },
  Volume: {
    prop: "volume",
    type: Number,
  },
  Supply: {
    prop: "supply",
    type: String,
  },
  Description: {
    prop: "description",
    type: String,
  },
};

dotenv.config();

const llm = new OpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: "text-davinci-003",
  presencePenalty: 0.0,
  frequencyPenalty: 0.0,
});

const memory = new BufferMemory();
const splitter = new CharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 0,
});
let docs, tempDocs;

// read excel file & prepare dataset
readXlsxFile("./given.xlsx", { schema }).then(({ rows, errors }) => {
  // prompt as possible customer requirement, completion as wine name reply
  tempDocs = rows.map(
    (row) =>
      new Document({
        pageContent: `This is Zk-Rollup named ${row.name}. Token symbol of ${
          row.name
        } is ${row.tokenSymbol}. ${
          row.tokenSymbol
        } was last taken on ${row.date.toDateString()}. ${row.tokenSymbol} has${
          row.released === "Yes" ? "" : " not"
        } been released. Price of ${row.tokenSymbol} is ${
          row.price
        }$. Price change of ${row.tokenSymbol} in last week is ${(
          row.weekChange * 100
        ).toFixed(2)}%. Price change of ${row.tokenSymbol} in last month is ${(
          row.monthChange * 100
        ).toFixed(2)}%. Total market value (Market Cap) of ${
          row.tokenSymbol
        }'s circulating supply is ${
          row.marketCap
        }$. Trading amount(Volume) traded in the last 24 hours is ${
          row.volume
        }$. Amount of coins circulating in market and public hands of ${
          row.tokenSymbol
        } is ${row.supply}. ${row.description}`,
      })
  );

  readXlsxFile("./qa.xlsx", {
    map: { Question: "question", Answer: "answer" },
  }).then(({ rows }) => {
    tempDocs.push(
      ...rows.map(
        (row) =>
          new Document({
            pageContent: `Question: ${row.question}\nAnswer: ${row.answer}`,
          })
      )
    );
    splitter.splitDocuments([...tempDocs]).then((res) => {
      docs = [...res];
    });
  });
});

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", async (req, res) => {
  res.status(200).send({
    message: "Hello from Zk-Rollup",
  });
});

const qa_template = `Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer but you have to say kindly to the normal greetings.
{context}
Question: {question}
Helpful Answer:`;
const qa_prompt = PromptTemplate.fromTemplate(qa_template);
const chain = loadQAStuffChain(llm, qa_prompt);

app.post("/", async (req, res) => {
  try {
    const query = req.body.prompt;

    const response = await chain.call({
      input_documents: docs,
      question: query,
    });

    res.status(200).send({
      bot: response.text,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error });
  }
});

app.listen(5000, () =>
  console.log("Server is running on port http://localhost:5000")
);
