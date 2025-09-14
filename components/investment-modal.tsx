"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Wallet,
  ArrowLeftRight,
} from "lucide-react";
import { useWallet } from "@/components/wallet-context";
import type { CircleResponse } from "@/lib/circle-api";
import { usePayment } from "@/hooks/use-payment";


// Assuming you are now importing the new config structure.
// Let's also assume the export is named CCTP_CONFIG for simplicity, or you've renamed it on import.
import { CCTP_V2_NETWORKS as CCTP_CONFIG } from "@/lib/cctp-config";
import { ethers } from "ethers";
import { set } from "date-fns";
import { ca } from "date-fns/locale";

const usdcContractAddress = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582"; // Mainnet USDC address as an example
const usdcAbi = [
  {
    "constant": true,
    "inputs": [],
    "name": "name",
    "outputs": [
      {
        "name": "",
        "type": "string"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "_spender",
        "type": "address"
      },
      {
        "name": "_value",
        "type": "uint256"
      }
    ],
    "name": "approve",
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "totalSupply",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "_from",
        "type": "address"
      },
      {
        "name": "_to",
        "type": "address"
      },
      {
        "name": "_value",
        "type": "uint256"
      }
    ],
    "name": "transferFrom",
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [
      {
        "name": "",
        "type": "uint8"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "name": "_owner",
        "type": "address"
      }
    ],
    "name": "balanceOf",
    "outputs": [
      {
        "name": "balance",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "symbol",
    "outputs": [
      {
        "name": "",
        "type": "string"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "_to",
        "type": "address"
      },
      {
        "name": "_value",
        "type": "uint256"
      }
    ],
    "name": "transfer",
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "name": "_owner",
        "type": "address"
      },
      {
        "name": "_spender",
        "type": "address"
      }
    ],
    "name": "allowance",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "name": "_from",
        "type": "address"
      },
      {
        "indexed": true,
        "name": "_to",
        "type": "address"
      },
      {
        "indexed": false,
        "name": "_value",
        "type": "uint256"
      }
    ],
    "name": "Transfer",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "name": "_owner",
        "type": "address"
      },
      {
        "indexed": true,
        "name": "_spender",
        "type": "address"
      },
      {
        "indexed": false,
        "name": "_value",
        "type": "uint256"
      }
    ],
    "name": "Approval",
    "type": "event"
  }
]
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";


interface InvestmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: {
    name: string;
    price: number;
    tokensAvailable: number;
    minimumInvestment?: number;
    apy?: number;
    tokenAddress: string;
  };
  investmentType: "estate" | "index-fund" | "treasury";
  recipientAddress: string;
  tokenAddress: string;
}

export function InvestmentModal({
  open,
  onOpenChange,
  asset,
  investmentType,
  recipientAddress,
  tokenAddress
}: InvestmentModalProps) {
  const { address: walletAddress } = useWallet();
  const [tokenAmount, setTokenAmount] = useState(1);
  const [selectedChain, setSelectedChain] = useState<string>("11155111");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentResult, setPaymentResult] = useState<CircleResponse | null>(
    null
  );
  const [showResult, setShowResult] = useState(false);
  const [requiresSignature, setRequiresSignature] = useState(false);
  const [transferTxHash, setTransferTxHash] = useState<string | null>(null);

  const { createPaymentIntent, processPayment } = usePayment();

  const totalCost = tokenAmount * asset.price;
  const expectedReturn = asset.apy ? (totalCost * asset.apy) / 100 : 0;

  // --- FIX #1: Changed how `availableChains` is created to read the correct `chainId` property ---
  const availableChains = Object.values(CCTP_CONFIG).map((config) => ({
    id: config.chainId,
    name: config.name,
    symbol: config.nativeSymbol || "ETH",
  }));

  // --- FIX #2: Changed how `selectedChainInfo` is found to match the new config structure ---
  const selectedChainInfo = Object.values(CCTP_CONFIG).find(
    (config) => config.chainId.toString() === selectedChain
  );

  const handleChainChange = (value: string) => {
    setSelectedChain(value);
  };

  const handleTransfer = async () => {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      console.log("Provider:", provider);
      const signer = provider.getSigner();
      console.log("Signer:", signer);
      const usdcContract = new ethers.Contract(
        usdcContractAddress,
        usdcAbi,
        signer
      );
      console.log("USDC Contract:", usdcContract);
      const amountInWei = ethers.utils.parseUnits(totalCost.toString(), 6); // USDC has 6 decimals
      console.log("Amount in Wei:", amountInWei.toString());
      const tx = await usdcContract.transfer("0x0af700A3026adFddC10f7Aa8Ba2419e8503592f7", amountInWei);
      console.log("Transfer Transaction:", tx);
      await tx.wait();
      console.log("Transfer confirmed");
      return tx;
    } catch (error) {
      console.error("Transfer failed:", error);
      throw error;
    }
  }



  const handleInvestment = async () => {
    // if (!walletAddress) {
    //   setPaymentResult({
    //     success: false,
    //     error: "Please connect your wallet first",
    //   });
    //   setShowResult(true);
    //   return;
    // }

    // if (asset.minimumInvestment && totalCost < asset.minimumInvestment) {
    //   setPaymentResult({
    //     success: false,
    //     error: `Minimum investment is $${asset.minimumInvestment} USDC`,
    //   });
    //   setShowResult(true);
    //   return;
    // }

    // setIsProcessing(true);
    // setPaymentResult(null);
    // setRequiresSignature(true);

    // try {
    //   const paymentIntent = await createPaymentIntent({
    //     amount: totalCost,
    //     chainId: Number(selectedChain),
    //     recipientAddress,
    //     metadata: {
    //       investmentType,
    //       assetName: asset.name,
    //       tokenAmount,
    //     },
    //   });

    //   if (!paymentIntent.success) {
    //     throw new Error(
    //       paymentIntent.error || "Failed to create payment intent"
    //     );
    //   }

    //   const result = await processPayment({
    //     paymentIntentId: paymentIntent.data!.id,
    //     chainId: Number(selectedChain),
    //     fromAddress: walletAddress,
    //     toAddress: recipientAddress,
    //     amount: totalCost,
    //   });

    //   if (result.requiresWalletSignature && result.transactionData) {
    //     const txHash = await (window as any).ethereum.request({
    //       method: "eth_sendTransaction",
    //       params: [
    //         {
    //           from: walletAddress,
    //           to: result.transactionData.to,
    //           data: result.transactionData.data,
    //           value: result.transactionData.value,
    //           gas: result.transactionData.gasLimit,
    //         },
    //       ],
    //     });

    //     setPaymentResult({
    //       success: true,
    //       txHash: txHash,
    //       data: {
    //         walletId: walletAddress,
    //         recipientAddress,
    //         amount: totalCost,
    //         currency: "USDC",
    //         chainId: Number(selectedChain),
    //         timestamp: new Date().toISOString(),
    //       },
    //     });
    //   } else {
    //     setPaymentResult(result);
    //   }

    //   setShowResult(true);
    //   setRequiresSignature(false);

    //   if (result.success || result.requiresWalletSignature) {
    //     setTimeout(() => {
    //       setTokenAmount(1);
    //       setShowResult(false);
    //       onOpenChange(false);
    //     }, 3000);
    //   }
    // } catch (error: any) {
    //   console.error("[v0] Investment transaction failed:", error);
    //   let errorMessage = `Payment failed. Please ensure you have sufficient USDC balance on ${
    //     selectedChainInfo?.name || "selected network"
    //   }.`;
    //   if (error.code === 4001) {
    //     errorMessage = "Transaction was rejected by user.";
    //   } else if (
    //     error.code === -32603 ||
    //     error.message?.includes("insufficient funds")
    //   ) {
    //     errorMessage = "Insufficient USDC balance or gas fees.";
    //   }
    //   setPaymentResult({ success: false, error: errorMessage });
    //   setShowResult(true);
    //   setRequiresSignature(false);
    // } finally {
    //   setIsProcessing(false);
    // }

    try {
      setIsProcessing(true);
      await handleTransfer();
      const amountInWei = ethers.utils.parseUnits(totalCost.toString(), 6);
    
      const response = await fetch(`${API_BASE_URL}/invest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          "to": walletAddress,
          "amount": amountInWei.toString(),
          "tokenAddress": asset.tokenAddress,

        }),
      });
      const data = await response.json();
      console.log("Investment response data:", data);
      console.log("Hash", data.transactionHash);
      setTransferTxHash(data.transactionHash);
      alert(`Investment successful!, Transaction Hash: ${data.transactionHash}`);
      setIsProcessing(false);
      setTokenAmount(0);
    } catch (error) {
      console.error("Investment failed:", error);
      alert("Investment failed. Please try again.");
           setIsProcessing(false);
      return;
    }





  };

  const resetModal = () => {
    setShowResult(false);
    setPaymentResult(null);
    setTokenAmount(1);
    setRequiresSignature(false);
  };

  if (requiresSignature && isProcessing) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-[#3A86FF]" />
              Wallet Signature Required
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert className="border-blue-200 bg-blue-50">
              <Wallet className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                Please check your wallet and sign the transaction to transfer{" "}
                {totalCost.toFixed(2)} USDC for your investment in {asset.name}.
              </AlertDescription>
            </Alert>
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">Amount</span>
                <span className="font-medium">{totalCost.toFixed(2)} USDC</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">Network</span>
                <span className="font-medium">
                  {selectedChainInfo?.name || "Unknown"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Tokens</span>
                <span className="font-medium">
                  {tokenAmount} {asset.name}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-8 w-8 animate-spin text-[#3A86FF]" />
            </div>
            <p className="text-sm text-center text-muted-foreground">
              Waiting for wallet signature...
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (showResult && paymentResult) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {paymentResult.success ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Investment Successful
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-red-600" />
                  Investment Failed
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {paymentResult.success ? (
              <div className="space-y-3">
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Your investment of {tokenAmount} tokens (
                    {totalCost.toFixed(2)} USDC) in {asset.name} has been
                    processed successfully on {selectedChainInfo?.name}!
                  </AlertDescription>
                </Alert>
                {(paymentResult.data?.txHash || paymentResult.txHash) && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      Transaction Hash:
                    </p>
                    <p className="font-mono text-xs break-all">
                      {paymentResult.data?.txHash || paymentResult.txHash}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <Alert className="border-red-200 bg-red-50">
                <XCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  {paymentResult.error || `Payment processing failed.`}
                </AlertDescription>
              </Alert>
            )}
            <div className="flex gap-3">
              {paymentResult.success ? (
                <Button
                  className="flex-1 bg-gradient-to-tr from-[#3A86FF] to-[#1f6fff] text-white"
                  onClick={() => onOpenChange(false)}
                >
                  Done
                </Button>
              ) : (
                <>
                  <Button
                    className="flex-1 bg-gradient-to-tr from-[#3A86FF] to-[#1f6fff] text-white"
                    onClick={resetModal}
                  >
                    Try Again
                  </Button>
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetModal();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-md bg-white border-slate-200">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-foreground">
            Invest in {asset.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">Price per Token</span>
              <span className="font-medium text-foreground">${asset.price.toFixed(2)} USDC</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Available Tokens</span>
              <span className="font-medium text-foreground">{asset.tokensAvailable.toLocaleString()}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="chain-select" className="text-sm font-medium text-foreground">
              Payment Network
            </Label>
            {/* Hardcoded for simplicity as in your original code */}
            <p className="p-2 border rounded-md bg-slate-50 text-sm">Polygon Amoy</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="token-amount" className="text-sm font-medium text-foreground">
              Number of Tokens
            </Label>
            <Input
              id="token-amount"
              type="number"
              min="0"
              max={asset.tokensAvailable}
              value={tokenAmount}
              onChange={(e) => setTokenAmount(Number(e.target.value))}
              className="bg-white border-slate-200 text-foreground"
              disabled={isProcessing}
            />
            <p className="text-xs text-muted-foreground">
              {asset.minimumInvestment && `Minimum: $${asset.minimumInvestment} USDC • `}
              Maximum: {asset.tokensAvailable.toLocaleString()} tokens
            </p>
          </div>

          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">Total Investment</span>
              <span className="text-lg font-semibold text-[#3A86FF]">${totalCost.toFixed(2)} USD</span>
            </div>
            {expectedReturn > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Expected Annual Return</span>
                <span className="font-medium text-green-600">${expectedReturn.toFixed(2)} USD</span>
              </div>
            )}
          </div>

          {!walletAddress && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertDescription className="text-yellow-800">
                Please connect your wallet to proceed with the investment.
              </AlertDescription>
            </Alert>
          )}

          <Alert className="border-blue-200 bg-blue-50">
            <Wallet className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              Ensure you have sufficient USDC balance on {selectedChainInfo?.name || "the network"} to complete this transaction.
            </AlertDescription>
          </Alert>
          <div className="flex gap-3 pt-4">
            <Button
              className="flex-1 bg-gradient-to-tr from-[#3A86FF] to-[#1f6fff] text-white hover:opacity-95"
              onClick={handleInvestment}
              disabled={isProcessing || !walletAddress}
            >
              {isProcessing ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
              ) : (
                "Proceed to Payment"
              )}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
              Cancel
            </Button>
         
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

