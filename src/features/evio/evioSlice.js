import { createSlice } from "@reduxjs/toolkit";

export const elementTypes = {
  eleNode: "ElementTypeNode",
  eleTunnel: "ElementTypeTunnel",
  eleNone: "ElementTypeNone",
};

const evioSlice = createSlice({
  name: "evio",
  initialState: {
    selectedOverlayId: "",
    cyElements: [],
    selectedElementType: elementTypes.eleTypeNone,
    selectedElementData: JSON.stringify({}),
    redrawGraph: false,
  },
  reducers: {
    setSelectedOverlayId(state, action) {
      state.selectedOverlayId = action.payload;
    },
    setCyElements(state, action) {
      state.cyElements = action.payload;
    },
    setSelectedElement(state, action) {
      state.selectedElementType = action.payload.selectedElementType;
      state.selectedElementData = JSON.stringify(
        action.payload.selectedElementData
      );
    },
    clearSelectedElement(state) {
      state.elementType = elementTypes.eleNone;
      state.selectedElementData = JSON.stringify({});
    },
    setRedrawGraph(state, action) {
      state.redrawGraph = action.payload.redrawGraph;
    },
  },
});

export const {
  setSelectedOverlayId,
  setCyElements,
  setSelectedElement,
  clearSelectedElement,
  setRedrawGraph,
} = evioSlice.actions;

export default evioSlice.reducer;
