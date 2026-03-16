import './polyfill'; // 1 numara: Sistemi önce bu dosyayı okumaya ZORLUYORUZ.
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);