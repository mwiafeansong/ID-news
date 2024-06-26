import express from 'express';
import xml2js from 'xml2js';
import axios from 'axios';
import fs from 'fs';
import cron from 'node-cron';
import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';

const app = express();

//init firebase app
initializeApp(firebaseConfig);

//init firestore
const db = getFirestore();

//collection ref
const colRef = collection(db, 'articles');

//get collection data
// getDocs(colRef)
//   .then((snapshot) => {
//     let articles = [];
//     snapshot.docs.forEach((doc) => {
//       articles.push({ ...doc.data(), id: doc.id });
//     });
//   })
//   .catch((error) => {
//     console.log(error.message);
//   });

//get collection data in real time
onSnapshot(colRef, (snapshot) => {
  let articles = [];
  snapshot.docs.forEach((doc) => {
    articles.push({ ...doc.data(), id: doc.id });
  });
  console.log(articles);
});

const parseOPML = async () => {
  const opml = fs.readFileSync('feedly.opml', 'utf8');
  const parser = new xml2js.Parser();
  const result = await parser.parseStringPromise(opml);

  const feeds = result.opml.body[0].outline[0].outline.map(
    (feed) => feed.$.xmlUrl
  );
  for (const feed of feeds) {
    fetchArticles(feed);
  }
};

const fetchArticles = async (feedUrl) => {
  try {
    //let allArticles = [];
    const response = await axios.get(feedUrl);
    const parser = await xml2js.Parser();
    const feed = await parser.parseStringPromise(response.data);

    const articles = feed.rss.channel[0].item;
    for (const article of articles) {
      const title = article.title[0];
      const date = new Date(article.pubDate);
      const author = article['dc:creator'] ? article['dc:creator'][0] : 'N/A';
      const summary = article.description ? article.description[0] : 'N/A';
      const url = article.link[0];

      const newArticle = {
        title,
        publication_date: date,
        author,
        summary,
        url,
      };

      //check if the article already exists
      const q = query(colRef, where('url', '==', url));
      const querySnapshot = await getDocs(q);

      //if it doesn't add it to the database
      if (querySnapshot.empty) {
        addDoc(colRef, newArticle);
      } else {
        return;
      }
    }
  } catch (error) {
    console.log(error.message);
  }
};

cron.schedule('0 * * * *', () => {
  console.log('Fetching new articles...');
  parseOPML();
});

//parseOPML();

app.listen(5000, () => {
  console.log('Listening on port 5000...');
});
