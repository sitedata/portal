import React from "react";
//import cytoscape from "cytoscape";
import CytoscapeComponent from "react-cytoscapejs";
import CollapsibleButton from "./CollapsibleButton";
import cytoscapeStyle from "./cytoscapeStyle.js";
import { Typeahead } from "react-bootstrap-typeahead";
import { Spinner } from "react-bootstrap";
import SideBar from "./Sidebar";
import { connect } from "react-redux";
import { setCyElements } from "../features/evio/evioSlice";
import {
  setSelectedElement,
  clearSelectedElement,
  elementTypes,
  setRedrawGraph,
} from "../features/evio/evioSlice";
import { setCurrentView } from "../features/view/viewSlice";
import { setZoomValue } from "../features/tools/toolsSlice";

const nodeStates = {
  connected: "Connected",
  noTunnels: "No Tunnels",
  notReporting: "Not Reporting",
};

class TopologyView extends React.Component {
  constructor(props) {
    super(props);
    this.intervalId = null;
    this.timeoutId = null;
    this.autoRefresh = this.props.autoUpdate;
    this.cy = null;
    this._typeahead = null;
  }

  /**
   * Polling function on GET Topology data - runs untill autoUpdate is disabled
   * @param {String} overlayId
   * @param {String} intervalId
   */
  async apiQueryTopology(overlayId, intervalId) {
    var url = "/topology?overlayid=" + overlayId + "&interval=" + intervalId;
    var resp = await fetch(url).then((res) => {
      return res.json();
    });
    console.log("apiQueryTopology: ", resp);
    return resp;
  }

  queryTopology() {
    if (this.autoRefresh)
      this.apiQueryTopology(this.props.currentOverlayId, this.intervalId)
        .then((res) => {
          if (this.autoRefresh) {
            this.props.setCyElements(this.buildCyElements(res[0].Topology));
            console.log("cyElements:", this.props.cyElements);
            this.intervalId = res[0]._id;
            this.queryTopology();
          }
        })
        .catch((err) => {
          console.warn("query topology failed ", err);
          if (this.autoRefresh) {
            this.timeoutId = setTimeout(this.queryTopology.bind(this), 30000);
          }
        });
  }

  renderTypeahead() {
    return (
      <Typeahead
        id="searchTopology"
        onChange={(selected) => {
          if (selected.length > 0) {
            let selectedEle = this.cy
              .elements()
              .getElementById(selected[0].data.id);
            this.cy.elements().unselect();
            selectedEle.select();
            let part = this.partitionElements(selectedEle);
            part.neighborhood.removeClass("transparent");
            part.excluded.addClass("transparent");
          }
        }}
        ref={(ref) => (this._typeahead = ref)}
        options={this.props.cyElements}
        placeholder={"search by node or tunnel ID"}
        labelKey={(option) => {
          return `${option.data.label}`;
        }}
        renderMenuItemChildren={(option) => {
          return (
            <div className="searchResult">
              <div className="resultLabel">
                <b>{option.data.label}</b>
              </div>
              <small className="resultLabel">{`ID : ${option.data.id}`}</small>
              <br />
            </div>
          );
        }}
      ></Typeahead>
    );
  }

  getNotReportingNodeDetails(notReportingNode) {
    var nodeContent = (
      <CollapsibleButton
        id={notReportingNode.data().id + "Btn"}
        className="detailsNodeBtn"
        key={notReportingNode.data().id + "Btn"}
        name={"Details"}
        isOpen
      >
        <div>
          <h5>{notReportingNode.data().label}</h5>
          <div className="DetailsLabel">Node ID</div>
          <label id="valueLabel">{notReportingNode.data().id}</label>
          <div className="DetailsLabel">State</div>
          <label id="valueLabel">{notReportingNode.data().state}</label>
          <div className="DetailsLabel">Location</div>
          <label id="valueLabel">{"Unknown"}</label>
          <hr style={{ backgroundColor: "#486186" }} />
        </div>
      </CollapsibleButton>
    );
    return nodeContent;
  }
  getConnectedLinkDetails(source, tgt, connectedEdges) {
    for (var edge of connectedEdges) {
      if (
        (source.data().id === edge._private.data.source &&
          tgt.id === edge._private.data.target) ||
        (source.data().id === edge._private.data.target &&
          tgt.id === edge._private.data.source)
      ) {
        for (var descriptorItem of edge._private.data.descriptor) {
          if (
            source.data().id === descriptorItem.Source &&
            tgt.id === descriptorItem.Target
          ) {
            return [descriptorItem, edge._private.data.id];
          }
        }
      }
    }
  }
  getConnectedNodeDetails(sourceNode, connectedNodes, connectedEdges) {
    var sidebarNodeslist = [];
    for (var el of connectedNodes) {
      if (sourceNode.data() !== el._private.data) {
        sidebarNodeslist.push(el._private.data);
      }
    }
    var nodeContent = (
      <CollapsibleButton
        id={sourceNode.data().id + "Btn"}
        className="detailsNodeBtn"
        key={sourceNode.data().id + "Btn"}
        name={"Details"}
        isOpen
      >
        <div>
          <h5>{sourceNode.data().name}</h5>
          <div id="DetailsLabel">Node ID</div>
          <label id="valueLabel">{sourceNode.data().id}</label>
          <div className="DetailsLabel">State</div>
          <label id="valueLabel">{sourceNode.data().state}</label>
          <div className="DetailsLabel">Location</div>
          <label id="valueLabel">{"Unknown"}</label>
          <hr style={{ backgroundColor: "#486186" }} />
          <div id="connectedNode" style={{ overflow: "auto" }}>
            {sidebarNodeslist.map((connectedNode) => {
              try {
                let [connectedlinkDetail, tunnelId] =
                  this.getConnectedLinkDetails(
                    sourceNode,
                    connectedNode,
                    connectedEdges
                  );
                var connectedNodeBtn = (
                  <CollapsibleButton
                    id={connectedNode.id + "Btn"}
                    className="connectedNodeBtn"
                    key={connectedNode.id + "Btn"}
                    eventKey={connectedNode.label}
                    name={connectedNode.label}
                  >
                    <div className="DetailsLabel">Node ID</div>
                    <label id="valueLabel">{connectedNode.id}</label>
                    <div className="DetailsLabel">Tunnel ID</div>
                    <label id="valueLabel">{tunnelId}</label>
                    <div className="DetailsLabel">Interface Name</div>
                    <label id="valueLabel">{connectedlinkDetail.TapName}</label>
                    <div className="DetailsLabel">MAC</div>
                    <label id="valueLabel">{connectedlinkDetail.MAC}</label>
                    <div className="DetailsLabel">State</div>
                    <label id="valueLabel">
                      {connectedlinkDetail.State.slice(
                        7,
                        connectedlinkDetail.State.length
                      )}
                    </label>
                    <div className="DetailsLabel">Tunnel Type</div>
                    <label id="valueLabel">
                      {connectedlinkDetail.Type.slice(
                        6,
                        connectedlinkDetail.Type.length
                      )}
                    </label>
                  </CollapsibleButton>
                );

                return connectedNodeBtn;
              } catch (e) {
                //console.log(e)
                return false;
              }
            })}
          </div>
        </div>
      </CollapsibleButton>
    );
    return nodeContent;
  }
  getNotConnectedNodeDetails(notConnectedNode) {
    var nodeContent = (
      <CollapsibleButton
        id={notConnectedNode.data().id + "Btn"}
        className="detailsNodeBtn"
        key={notConnectedNode.data().id + "Btn"}
        name={"Details"}
        isOpen
      >
        <div>
          <h5>{notConnectedNode.data().label}</h5>
          <div className="DetailsLabel">Node ID</div>
          <label id="valueLabel">{notConnectedNode.data().id}</label>
          <div className="DetailsLabel">State</div>
          <label id="valueLabel">{notConnectedNode.data().state}</label>
          <div className="DetailsLabel">Location</div>
          <label id="valueLabel">{"Unknown"}</label>
          <hr style={{ backgroundColor: "#486186" }} />
        </div>
      </CollapsibleButton>
    );
    return nodeContent;
  }

  renderNodeDetails = () => {
    var selectedEle = JSON.parse(this.props.selectedCyElementData);
    var selectedNode = this.cy.getElementById(selectedEle.id);
    var partitionElements = this.partitionElements(selectedNode);
    var connectedNodes = partitionElements.neighborhood.filter((ele) =>
      ele.isNode()
    );
    var connectedEdges = partitionElements.neighborhood.filter((ele) =>
      ele.isEdge()
    );
    if (selectedEle.state === nodeStates.notReporting) {
      return this.getNotReportingNodeDetails(selectedNode); //Not reporting nodes
    } else if (selectedEle.state === nodeStates.connected) {
      return this.getConnectedNodeDetails(
        selectedNode,
        connectedNodes,
        connectedEdges
      ); //Connected nodes
    } else if (selectedEle.state === nodeStates.notConnectedNode) {
      return this.getNotConnectedNodeDetails(selectedNode); //Not connected node
    }
  };

  renderSidebarDetails() {
    if (this.props.selectedElementType === elementTypes.eleNode)
      return this.renderNodeDetails();
    else if (this.props.selectedElementType === elementTypes.eleTunnel)
      return <null />;
    return <null />;
  }

  renderTopologyContent() {
    // if (this.cy) {
    //   console.log("renderTopologyContent cy zoom val before", this.cy.zoom());
    //   this.cy.zoom(this.props.zoomValue);
    //   console.log("renderTopologyContent cy zoom val after", this.cy.zoom());
    // } else console.log("renderTopologyContent no cy yet");
    // if (this.props.cyElements.length === 0) {
    //   return <Spinner id="loading" animation="border" variant="info" />;
    // }
    const topologyContent = (
      <CytoscapeComponent
        id="cy"
        cy={(cy) => {
          this.cy = cy;
          //this.cy.maxZoom(this.props.zoomMax);
          //this.cy.minZoom(this.props.zoomMin);
          // console.log("cy zoom val before", this.cy.zoom());
          // this.cy.zoom(this.props.zoomValue);
          // console.log("cy zoom val after", this.cy.zoom());
          //this.cy.center();
          this.cy.layout({ name: "circle", clockwise: true }).run();
          this.cy.on("click", this.handleCytoClick.bind(this));
        }}
        wheelSensitivity={0.1}
        elements={JSON.parse(JSON.stringify(this.props.cyElements))} //props.cyElements are frozen
        stylesheet={cytoscapeStyle}
        style={{ width: window.innerWidth, height: window.innerHeight }}
      />
    );

    return topologyContent;
  }

  handleWheel(e) {
    this.props.setZoomValue(this.cy.zoom());
  }

  handleRedrawGraph = () => {
    this.cy.layout({ name: "circle" }).run();
    this.cy.zoom(this.props.zoomValue);
    this.cy.center();
    //setting the redrawGraph back to false after the action so that
    //it will be again active for next click event in breadcrumb component
    this.props.setRedrawGraph({
      redrawGraph: "false",
    });
  };

  buildCyElements = (topologies) => {
    var elements = [];
    var nodeDetails = {};

    if (topologies.length < 1) return elements;
    var topology = topologies[0];

    for (var nid in topology.Nodes) {
      var node = topology.Nodes[nid];
      var nodeData = {
        group: "nodes",
        data: {
          id: node.NodeId,
        },
      };
      if (node.hasOwnProperty("NodeName"))
        nodeData["data"]["label"] = node.NodeName;
      else nodeData["data"]["label"] = node.NodeId.slice(0, 12);
      if (node.hasOwnProperty("Version"))
        nodeData["data"]["version"] = node.Version;
      if (node.hasOwnProperty("GeoCoordinates"))
        nodeData["data"]["coords"] = node.GeoCoordinates;
      if (node.hasOwnProperty("Edges")) {
        nodeData["data"]["edges"] = node.Edges;
        if (node.Edges.length === 0) {
          nodeData["data"]["state"] = nodeStates.noTunnels;
          nodeData["data"]["color"] = "#F2BE22";
        } else {
          nodeData["data"]["state"] = nodeStates.connected;
          nodeData["data"]["color"] = "#8AA626";
        }
      } else {
        nodeData["data"]["state"] = nodeStates.notReporting;
        nodeData["data"]["color"] = "#ADD8E6";
      }
      nodeDetails[node.NodeId] = nodeData;
    }
    for (var edgeId in topology.Edges) {
      var edge = topology.Edges[edgeId];
      if (edge["Descriptor"].length > 2) {
        console.error(
          "Too many edge descriptors reported ",
          JSON.stringify(edge["Descriptor"])
        );
      }
      var edgeData = {
        group: "edges",
        data: {},
      };
      edgeData["data"]["id"] = edge.EdgeId;
      edgeData["data"]["descriptor"] = edge["Descriptor"];
      edgeData["data"]["label"] = edge.EdgeId.slice(0, 12);
      edgeData["data"]["source"] = edge["Descriptor"][0].Source;
      edgeData["data"]["target"] = edge["Descriptor"][0].Target;
      edgeData["data"]["color"] = this.getLinkColor(edge["Descriptor"][0].Type);
      edgeData["data"]["style"] = this.getLinkStyle(
        edge["Descriptor"][0].State
      );
      if (
        edge["Descriptor"].length === 2 &&
        edge["Descriptor"][0].Source > edge["Descriptor"][1].Source
      ) {
        edgeData["data"]["source"] = edge["Descriptor"][1].Source;
        edgeData["data"]["target"] = edge["Descriptor"][1].Target;
        edgeData["data"]["color"] = this.getLinkColor(
          edge["Descriptor"][1].Type
        );
        edgeData["data"]["style"] = this.getLinkStyle(
          edge["Descriptor"][1].State
        );
      }
      elements.push(edgeData);
    }
    var nodes = Object.keys(nodeDetails).sort();
    nodes.forEach((nodeId) => elements.push(nodeDetails[nodeId]));

    return elements;
  };

  getLinkColor(type) {
    var linkColor;
    switch (type) {
      case "CETypeILongDistance":
        linkColor = "#5E4FA2";
        break;
      case "CETypeLongDistance":
        linkColor = "#5E4FA2";
        break;
      case "CETypePredecessor":
        linkColor = "#01665E";
        break;
      case "CETypeSuccessor":
        linkColor = "#01665E";
        break;
      default:
        break;
    }
    return linkColor;
  }

  getLinkStyle(state) {
    var linkStyle;
    switch (state) {
      case "CEStateInitialized":
      case "CEStatePreAuth":
      case "CEStateAuthorized":
      case "CEStateCreated":
        linkStyle = "dotted";
        break;
      case "CEStateConnected":
        linkStyle = "solid";
        break;
      case "CEStateDisconnected":
      case "CEStateDeleting":
        linkStyle = "dashed";
        break;
      default:
        break;
    }
    return linkStyle;
  }

  partitionElements(selectedElement) {
    var neighborhood;
    var excluded;
    if (selectedElement.isNode()) {
      this.props.setSelectedElement({
        selectedElementType: elementTypes.eleNode,
        selectedCyElementData: selectedElement.data(),
      });
      neighborhood = selectedElement
        .outgoers()
        .union(selectedElement.incomers())
        .union(selectedElement);
      excluded = this.cy
        .elements()
        .difference(
          selectedElement.outgoers().union(selectedElement.incomers())
        )
        .not(selectedElement);
    } else if (selectedElement.isEdge()) {
      this.props.setSelectedElement({
        selectedElementType: elementTypes.eleTunnel,
        selectedCyElementData: selectedElement.data(),
      });
      neighborhood = selectedElement
      .connectedNodes()
      .union(selectedElement);
      excluded = this.cy
        .elements()
        .difference(selectedElement.connectedNodes())
        .not(selectedElement);
    }
    return { neighborhood, excluded };
  }

  handleCytoClick(event) {
    var selectedElement = event.target[0];
    var part;
    try {
      if (event.target === this.cy) {
        this.props.clearSelectedElement();
        this.cy.elements().removeClass("transparent");
        this._typeahead.clear();
      } else {
        part = this.partitionElements(selectedElement);
        part.neighborhood.removeClass("transparent");
        part.excluded.addClass("transparent");
      }
    } catch (error) {
      this.props.clearSelectedElement();
      this.cy.elements().removeClass("transparent");
    }
  }

  componentDidMount() {
    this.props.setCurrentView("TopologyView");
    this.queryTopology();
    this.autoRefresh = this.props.autoUpdate;
  }

  componentDidUpdate(prevProps, prevState) {
    // console.log(
    //   "componentDidUpdate: cyzoom min < val < max",
    //   this.cy.minZoom(),
    //   this.cy.zoom(),
    //   this.cy.maxZoom()
    // );
    this.cy.zoom(this.props.zoomValue);
    this.cy.minZoom(this.props.zoomMin);
    this.cy.maxZoom(this.props.zoomMax);
    //this.cy.center();
    // console.log(
    //   "componentDidUpdate after: cyzoom min < val < max",
    //   this.cy.minZoom(),
    //   this.cy.zoom(),
    //   this.cy.maxZoom()
    // );
    // if (this.props.zoomValue !== prevProps.zoomValue) {
    //   console.log("componentDidUpdate: updating cy zoom val");
    //   this.cy.zoom(this.props.zoomValue);
    // }
    // if (this.props.zoomMin !== prevProps.zoomMin) {
    //   this.cy.minZoom(this.props.zoomMin);
    // }
    // if (this.props.zoomMax !== prevProps.zoomMax) {
    //   this.cy.maxZoom(this.props.zoomMax);
    // }
    if (this.props.redrawGraph !== prevProps.redrawGraph) {
      //if the current view is topology and redrawGraph flag is false then call handleredrawgraph
      //else the current view would be overlay view
      if (
        this.props.currentView === "TopologyView" &&
        this.props.redrawGraph !== "false"
      ) {
        this.handleRedrawGraph();
      }
    }
    if (this.props.autoUpdate !== prevProps.autoUpdate) {
      this.autoRefresh = this.props.autoUpdate;
      if (this.autoRefresh) {
        this.queryTopology();
      }
    }
  }

  componentWillUnmount() {
    this.autoRefresh = false;
    clearTimeout(this.timeoutId);
    this.props.clearSelectedElement();
    this.props.setCyElements([]);
  }

  render() {
    return (
      <>
        <section
          onWheel={this.handleWheel.bind(this)}
          style={{ width: "100vw", height: "100vh" }}
        >
          <div id="cyArea">{this.renderTopologyContent()}</div>
        </section>
        <div id="SidePanel">
          <SideBar
            typeahead={this.renderTypeahead()}
            sidebarDetails={this.renderSidebarDetails()}
          />
          {/* <div id="bottomTools">
              <Toolbar />
            </div> */}
        </div>
      </>
    );
  }
}

const mapStateToProps = (state) => ({
  currentOverlayId: state.evio.selectedOverlayId,
  selectedElementType: state.evio.selectedElementType,
  selectedCyElementData: state.evio.selectedCyElementData,
  cyElements: state.evio.cyElements,
  currentView: state.view.current,
  zoomValue: state.tools.zoomValue,
  zoomMin: state.tools.zoomMinimum,
  zoomMax: state.tools.zoomMaximum,
  autoUpdate: state.tools.autoUpdate,
  redrawGraph: state.evio.redrawGraph,
});

const mapDispatchToProps = {
  setCurrentView,
  setZoomValue,
  setCyElements,
  setSelectedElement,
  clearSelectedElement,
  setRedrawGraph,
};

export default connect(mapStateToProps, mapDispatchToProps)(TopologyView);
