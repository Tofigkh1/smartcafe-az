import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { persistReducer } from "redux-persist";
import storage from "redux-persist/lib/storage";
import axios from "axios";
import { base_url } from "../api/index";
import { migrations } from "./migrations";

// Headers ayarı
const getHeaders = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Async thunk
export const fetchOrderById = createAsyncThunk(
  "order/fetchById",
  async (id, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${base_url}/orders/${id}`, getHeaders());
      const formatted = response.data;
      const items = formatted?.items || [];

      const shareItems = items.map(({ name, quantity, price }) => ({
        name,
        quantity,
        price,
      }));

      const totalAmount = shareItems.reduce(
        (sum, item) => sum + (item.quantity || 0) * (item.price || 0),
        0
      );

      return {
        orderID: formatted.id || null,
        shares: [
          {
            type: "cash",
            amount: totalAmount,
            items: shareItems,
          },
        ],
        items: shareItems,
      };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Order fetch failed");
    }
  }
);

// Slice tanımı
const orderSlice = createSlice({
  name: "order",
  initialState: {
    orders: {},
    loading: false,
    error: null,
    lastUpdated: null // Yeni eklenen timestamp
  },
  reducers: {
    clearOrder: (state) => {
      state.orders = {};
      state.error = null;
    },
    setFormattedOrder: (state, action) => {
      const { id, items } = action.payload;

      const totalAmount = items.reduce(
        (sum, item) => sum + (item.quantity || 0) * (item.price || 0),
        0
      );

      // ❗ ID'ye göre ekle
      state.orders[id] = {
        orderID: id,
        shares: [
          {
            type: "cash",
            amount: totalAmount,
            items,
          },
        ],
        items,
      };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOrderById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchOrderById.fulfilled, (state, action) => {
        const { orderID } = action.payload;
        state.orders[orderID] = {
          ...action.payload,
          lastUpdated: Date.now()
        };
        state.loading = false;
      })
      .addCase(fetchOrderById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

// ❗ Persist config
const orderPersistConfig = {
  key: 'order',
  storage,
  version: 1,
  migrate: migrations[1],
  whitelist: ['orders']
};

export const { clearOrder, setFormattedOrder } = orderSlice.actions;

export default persistReducer(orderPersistConfig, orderSlice.reducer);
